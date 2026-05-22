import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  loadActions,
  loadCities,
  loadModelOutputs,
  loadPolicyScores,
  loadFeasibilityScores,
  loadLegalAssessments,
} from "@/lib/fixtures";
import { seededShuffle } from "@/lib/randomize";
import type {
  Action,
  DiscardedAction,
  PolicyScore,
  FeasibilityScore,
  LegalAssessment,
} from "@/lib/fixtures";
import { EvaluationForm } from "./EvaluationForm";

export const dynamic = "force-dynamic";

export type Stage = "stage1" | "stage2" | "sectionC" | "stage3" | "sectionE" | "complete";

export type RankedAction = {
  rank: number;
  action: Action;
  rationaleEs: string;
  rationaleEn: string;
};

export default async function EvaluatePage({ params }: { params: { cityId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expertId = session.user.id;
  const cityId = params.cityId;

  // Defend against stale JWTs: a session cookie minted before a DB reset
  // will still be cryptographically valid but reference an expertId that
  // no longer exists. Without this guard, /evaluate/<cityId> looks up an
  // assignment under that stale id, finds none, and 404s — confusing.
  // Force a sign-out instead so the user gets a clean session.
  const expert = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!expert) {
    redirect("/api/auth/signout?callbackUrl=/");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { expertId_cityId: { expertId, cityId } },
  });
  if (!assignment) notFound();

  const cities = loadCities();
  const city = cities.find((c) => c.cityId === cityId);
  if (!city) notFound();

  const outputs = loadModelOutputs();
  const cityOutput = outputs[cityId];
  if (!cityOutput) notFound();
  const actions = loadActions();
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  const rankedActions: RankedAction[] = cityOutput.topActions
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((t) => {
      const action = actionMap.get(t.actionId);
      if (!action) throw new Error(`actions.json missing actionId ${t.actionId}`);
      return {
        rank: t.rank,
        action,
        rationaleEs: t.rationaleEs,
        rationaleEn: t.rationaleEn,
      };
    });

  // Per-action ranking context: policy + feasibility (per city) + legal (country).
  // These come from the global-API and are loaded lazily here so the eval flow
  // can render the rich Stage-3 context sheet.
  const policyScores = loadPolicyScores();
  const feasibilityScores = loadFeasibilityScores();
  const legalAssessments = loadLegalAssessments();
  const cityPolicy = policyScores[cityId] ?? {};
  const cityFeasibility = feasibilityScores[cityId] ?? {};

  // Derive legally-blocked actions from the real legal API (verdict=blocked).
  // The country-wide legal verdict acts as a hard filter in the real pipeline.
  // The fixture's `discardedLegal` field is kept as a manual override; if
  // present it wins, otherwise we compute from the legal data.
  const fixtureDiscarded = cityOutput.discardedLegal ?? [];
  const discardedLegal: DiscardedAction[] =
    fixtureDiscarded.length > 0
      ? fixtureDiscarded
      : Object.values(legalAssessments)
          .filter((l) => l.verdictCategory === "blocked")
          .map((l) => ({
            actionId: l.srcActionId,
            reasonEs: `${l.ownershipDescriptionI18n.es} ${l.restrictionsDescriptionI18n.es}`.trim(),
            reasonEn: `${l.ownershipDescriptionI18n.en} ${l.restrictionsDescriptionI18n.en}`.trim(),
          }));

  // Find or create evaluation row (startedAt is set on first load).
  const evaluation = await prisma.evaluation.upsert({
    where: { expertId_cityId: { expertId, cityId } },
    create: { expertId, cityId },
    update: {},
    include: { ratings: true, reorderTop5: true },
  });

  // Split ratings by question so the form can render two independent stages.
  const top3Ratings: Record<string, { likert: number; notSure: boolean }> = {};
  const top10Ratings: Record<string, { likert: number; notSure: boolean }> = {};
  for (const r of evaluation.ratings) {
    const target = r.question === "top3" ? top3Ratings : top10Ratings;
    target[r.actionId] = { likert: r.likert, notSure: r.notSure };
  }

  const missingActions: string[] = evaluation.missingActions
    ? (JSON.parse(evaluation.missingActions) as string[])
    : [];

  const reorderTop5: string[] | null = evaluation.reorderTop5
    ? (JSON.parse(evaluation.reorderTop5.orderedActionIds) as string[])
    : null;

  // Deterministic display order — same on every load for the same (eval, city, stage).
  // Seed uses evaluationId so the order is stable per evaluation row (re-creating
  // the row would re-roll, which is the right semantic for a fresh attempt).
  const top3RandomOrder = seededShuffle(
    rankedActions.slice(0, 3),
    `${evaluation.id}::${cityId}::stage1`
  );
  const top10RandomOrder = seededShuffle(
    rankedActions,
    `${evaluation.id}::${cityId}::stage2`
  );

  // "Next" actions shown as read-only context inside each stage:
  //   - Stage 1: next 3 = the model's ranks 4..6 (drawn from topActions, no extra fetch)
  //   - Stage 2: next 5 = the model's ranks 11..15 (from cityOutput.nextActions)
  // Both groups are randomized deterministically.
  const stage1ContextActions: Action[] = seededShuffle(
    rankedActions.slice(3, 6).map((r) => r.action),
    `${evaluation.id}::${cityId}::stage1ctx`
  );
  const stage2ContextActions: Action[] = seededShuffle(
    (cityOutput.nextActions ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((n) => {
        const a = actionMap.get(n.actionId);
        if (!a) throw new Error(`nextActions references unknown actionId ${n.actionId}`);
        return a;
      }),
    `${evaluation.id}::${cityId}::stage2ctx`
  );

  return (
    <EvaluationForm
      city={city}
      rankedActions={rankedActions}
      stage1Order={top3RandomOrder}
      stage2Order={top10RandomOrder}
      stage1ContextActions={stage1ContextActions}
      stage2ContextActions={stage2ContextActions}
      discardedLegal={discardedLegal}
      allActions={actions}
      cityPolicy={cityPolicy}
      cityFeasibility={cityFeasibility}
      legalAssessments={legalAssessments}
      initial={{
        evaluationId: evaluation.id,
        currentStage: (evaluation.currentStage as Stage) ?? "stage1",
        submitted: !!evaluation.submittedAt,
        top3Ratings,
        top10Ratings,
        missingActions,
        reorderTop5,
        cityComment: evaluation.cityComment ?? "",
      }}
    />
  );
}
