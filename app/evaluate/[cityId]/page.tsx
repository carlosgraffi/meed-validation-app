import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadActions, loadCities, loadModelOutputs } from "@/lib/fixtures";
import { seededShuffle } from "@/lib/randomize";
import type { Action, DiscardedAction } from "@/lib/fixtures";
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

  // Legally-blocked actions for this city — hydrated with the action record
  // so we can show the action's name in the footnote.
  const discardedLegal: Array<DiscardedAction & { actionName: string }> = (
    cityOutput.discardedLegal ?? []
  ).map((d) => ({
    ...d,
    actionName: actionMap.get(d.actionId)?.nameEs ?? d.actionId,
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
      discardedLegal={cityOutput.discardedLegal ?? []}
      allActions={actions}
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
