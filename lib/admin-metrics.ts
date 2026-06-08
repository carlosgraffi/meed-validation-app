/**
 * Bridge between Prisma rows and the pure computeMetrics() function in lib/metrics.ts.
 *
 * Pulls all submitted evaluations from the DB, hydrates them into the EvaluationInput
 * shape, and feeds them through computeMetrics with the model's top-5 ordering per city
 * (derived from /data/model_outputs.json).
 */
import { prisma } from "./db";
import { loadExperts, loadModelOutputs } from "./fixtures";
import { computeMetrics, type EvaluationInput, type MetricsOutput } from "./metrics";
import { splitInputsByCohort, summarizeExperts, type CohortExpert } from "./cohorts";

/**
 * Shared loader: pull submitted fixture-expert evaluations and hydrate them
 * into the pure EvaluationInput shape, alongside the model's top-5 per city.
 * Both computeLiveMetrics and computeCohortMetrics build on this so they stay
 * in lock-step (same rows, same hydration).
 */
async function loadSubmittedInputs(): Promise<{
  inputs: EvaluationInput[];
  top5ByCity: Record<string, string[]>;
}> {
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
  const inputs: EvaluationInput[] = evals.map((e) => ({
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
    reorderTop5: e.reorderTop5
      ? (JSON.parse(e.reorderTop5.orderedActionIds) as string[])
      : null,
    // Post-reveal overall-agreement Likerts, added with the reveal stages.
    top3Agreement: e.top3Agreement,
    top10Agreement: e.top10Agreement,
  }));
  return { inputs, top5ByCity };
}

export async function computeLiveMetrics(): Promise<MetricsOutput> {
  const { inputs, top5ByCity } = await loadSubmittedInputs();
  return computeMetrics(inputs, top5ByCity);
}

export type CohortMetrics = {
  metrics: MetricsOutput;
  expertCount: number;
  evalCount: number;
  /** Roster of the experts included in this cohort (sorted by name). */
  experts: CohortExpert[];
};

export type CohortMetricsOutput = {
  /** Exclusive upper bound for Cohort 1 (a submission at the cutoff is Cohort 2). */
  cutoffISO: string;
  total: CohortMetrics;
  cohort1: CohortMetrics;
  cohort2: CohortMetrics;
};

/**
 * Same submitted evaluations as computeLiveMetrics, but additionally split into
 * two cohorts by each expert's FIRST submission (see lib/cohorts.ts). Returns
 * the full MetricsOutput for the total and each cohort, plus sample sizes.
 *
 * Read-only and additive: it re-runs the same pure computeMetrics() over row
 * subsets. `total` is byte-identical to computeLiveMetrics(), so the headline
 * contract number is unaffected.
 */
export async function computeCohortMetrics(
  cutoffISO: string
): Promise<CohortMetricsOutput> {
  const { inputs, top5ByCity } = await loadSubmittedInputs();
  const cutoffMs = Date.parse(cutoffISO);
  const { cohort1, cohort2 } = splitInputsByCohort(inputs, cutoffMs);

  // Resolve current display names for the roster (DB names reflect any edits
  // the expert made at onboarding; fall back to the id if missing).
  const nameRows = await prisma.expert.findMany({
    where: { id: { in: [...new Set(inputs.map((e) => e.expertId))] } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(nameRows.map((r) => [r.id, r.fullName]));

  const pack = (subset: EvaluationInput[]): CohortMetrics => {
    const experts = summarizeExperts(subset, nameById);
    return {
      metrics: computeMetrics(subset, top5ByCity),
      expertCount: experts.length,
      evalCount: subset.length,
      experts,
    };
  };

  return {
    cutoffISO,
    total: pack(inputs),
    cohort1: pack(cohort1),
    cohort2: pack(cohort2),
  };
}
