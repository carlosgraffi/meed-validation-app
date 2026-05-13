/**
 * Bridge between Prisma rows and the pure computeMetrics() function in lib/metrics.ts.
 *
 * Pulls all submitted evaluations from the DB, hydrates them into the EvaluationInput
 * shape, and feeds them through computeMetrics with the model's top-5 ordering per city
 * (derived from /data/model_outputs.json).
 */
import { prisma } from "./db";
import { loadExperts, loadModelOutputs } from "./fixtures";
import { computeMetrics, type MetricsOutput } from "./metrics";

export async function computeLiveMetrics(): Promise<MetricsOutput> {
  // Only fixture experts count toward the CORFO metric — exclude admin + demo accounts.
  const fixtureExpertIds = loadExperts().map((e) => e.expertId);
  const evals = await prisma.evaluation.findMany({
    where: {
      submittedAt: { not: null },
      expertId: { in: fixtureExpertIds },
    },
    include: { ratings: true, reorderTop5: true },
  });
  const outputs = loadModelOutputs();
  const top5ByCity: Record<string, string[]> = {};
  for (const [cityId, out] of Object.entries(outputs)) {
    top5ByCity[cityId] = out.topActions
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5)
      .map((t) => t.actionId);
  }
  return computeMetrics(
    evals.map((e) => ({
      expertId: e.expertId,
      cityId: e.cityId,
      submittedAt: e.submittedAt,
      ratings: e.ratings.map((r) => ({
        actionId: r.actionId,
        modelRank: r.modelRank,
        question: r.question as "top3" | "top10",
        likert: r.likert,
        notSure: r.notSure,
      })),
      reorderTop5: e.reorderTop5 ? (JSON.parse(e.reorderTop5.orderedActionIds) as string[]) : null,
    })),
    top5ByCity
  );
}
