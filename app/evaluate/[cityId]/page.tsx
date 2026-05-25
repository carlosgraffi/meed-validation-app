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

export type Stage =
  | "stage1"
  | "stage2"
  | "sectionC"
  | "stage3"
  | "reveal1"
  | "reveal2"
  | "sectionE"
  | "complete";

export type RankedAction = {
  rank: number;
  action: Action;
  // Neutral pillar-band rationale — rendered during the blind Stage 1 / Stage 2
  // ratings. Carries no rank-positioning prose.
  rationaleEs: string;
  rationaleEn: string;
  // LLM-authored, rank-positioning explanation — rendered ONLY on the reveal
  // stages (reveal1 / reveal2) after the expert has committed their blind
  // set ratings. Suppressed during Stage 3 reorder.
  explanationEs?: string;
  explanationEn?: string;
};

export default async function EvaluatePage({ params }: { params: { cityId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expertId = session.user.id;
  // Next.js 14 does not auto-decode dynamic route segments, so a URL like
  // /evaluate/CL%20PAO arrives here with params.cityId === "CL%20PAO".
  // Our cityIds contain literal spaces ("CL PAO"), so decode before any lookup.
  const cityId = decodeURIComponent(params.cityId);

  // Defend against stale JWTs: a session cookie minted before a DB reset
  // will still be cryptographically valid but reference an expertId that
  // no longer exists. Without this guard, /evaluate/<cityId> looks up an
  // assignment under that stale id, finds none, and 404s — confusing.
  // Force a sign-out instead so the user gets a clean session.
  const expert = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!expert) {
    redirect("/api/auth/signout?callbackUrl=/");
  }

  // Fixture validity comes first — a genuinely bogus cityId (typo, stale
  // bookmark from a removed city) is the only thing that warrants a hard 404.
  const cities = loadCities();
  const city = cities.find((c) => c.cityId === cityId);
  if (!city) notFound();

  const outputs = loadModelOutputs();
  const cityOutput = outputs[cityId];
  if (!cityOutput) notFound();

  // Assignment lookup. If the row is missing for a real, signed-in expert,
  // we don't 404 — that strands the user on a dead-end page. Instead we
  // log and bounce to /dashboard, which already knows how to handle the
  // expert's actual state (onboarding redirect, complete redirect, or
  // showing whatever assignments do exist).
  //
  // Stale-state causes we want to recover from gracefully:
  //   - JWT minted before a re-seed wiped/rebuilt assignments
  //   - Expert added to experts.json after the last `seed --stratify` ran
  //   - Bookmarked URL for a city no longer on the panel
  const assignment = await prisma.assignment.findUnique({
    where: { expertId_cityId: { expertId, cityId } },
  });
  if (!assignment) {
    console.warn(
      `[evaluate] missing assignment expertId=${expertId} cityId=${cityId} — redirecting to /dashboard`
    );
    redirect("/dashboard");
  }
  const actions = loadActions();
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  // currentStage drives which LLM explanations are even SHIPPED to the client
  // (RSC payload). Without this gate, a curious expert could open devtools
  // on Stage 1 and read the rank-positioning prose meant for Reveal-1,
  // defeating the bias controls. So:
  //   - top-3 explanations are included once currentStage >= reveal1
  //   - top-10 (ranks 4..10) explanations are included once >= reveal2
  // Once revealed they stay in the payload (the user has already seen them
  // and the locked Reveal section can be re-expanded to review them).
  //
  // Note the post-2026-05-25 stage order: reveals now sit AFTER stage3 so
  // P@3, P@10, AND Spearman ρ are all collected before any LLM-rationale
  // exposure. The reveal gates fire later in the pipeline accordingly.
  const stageBefore = (evaluationStage: string, target: string) => {
    const order = ["stage1", "stage2", "sectionC", "stage3", "reveal1", "reveal2", "sectionE", "complete"];
    return order.indexOf(evaluationStage) < order.indexOf(target);
  };
  const currentStageRaw = (await prisma.evaluation.findUnique({
    where: { expertId_cityId: { expertId, cityId } },
    select: { currentStage: true },
  }))?.currentStage ?? "stage1";
  const hideTop3Explanation = stageBefore(currentStageRaw, "reveal1");
  const hideTop10Explanation = stageBefore(currentStageRaw, "reveal2");
  const rankedActions: RankedAction[] = cityOutput.topActions
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((t) => {
      const action = actionMap.get(t.actionId);
      if (!action) throw new Error(`actions.json missing actionId ${t.actionId}`);
      const stripExplanation =
        t.rank <= 3 ? hideTop3Explanation : hideTop10Explanation;
      return {
        rank: t.rank,
        action,
        rationaleEs: t.rationaleEs,
        rationaleEn: t.rationaleEn,
        explanationEs: stripExplanation ? undefined : t.explanationEs,
        explanationEn: stripExplanation ? undefined : t.explanationEn,
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
        top3Agreement: evaluation.top3Agreement ?? null,
        top10Agreement: evaluation.top10Agreement ?? null,
        missingActions,
        reorderTop5,
        cityComment: evaluation.cityComment ?? "",
      }}
    />
  );
}
