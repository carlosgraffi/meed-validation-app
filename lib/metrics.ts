/**
 * Headline metric computation for the CORFO contract.
 *
 * Operational definition (Section 1 of the spec):
 *   A model recommendation MATCHES expert opinion when an expert rates it 4 or 5 on the Likert.
 *   The bar is met when ≥75% of the model's top 3 recommendations per city,
 *   averaged across all expert evaluations, achieve a match rating.
 *
 * - `top3MatchRate` is the headline; `top10MatchRate` is the secondary number.
 * - `notSure: true` ratings still count as ratings (they have a Likert value);
 *   the expert is just flagging uncertainty. The match definition uses Likert alone.
 * - Only SUBMITTED evaluations are included (submittedAt is non-null).
 * - Spearman top-5 compares the model's top 5 ranking to each expert's reorder
 *   (where present). Aggregated as the mean Spearman across experts who completed the reorder.
 *
 * Pure function — no DB, no side effects — to allow unit testing in lib/metrics.test.ts.
 */

export type RatingInput = {
  actionId: string;
  modelRank: number; // 1..10
  likert: number; // 1..5
  notSure: boolean;
};

export type EvaluationInput = {
  expertId: string;
  cityId: string;
  submittedAt: Date | string | null;
  ratings: RatingInput[];
  reorderTop5?: string[] | null; // ordered actionIds, length 5
};

export type CityMetrics = {
  expertsCompleted: number;
  top3MatchRate: number | null;
  top10MatchRate: number | null;
  spearmanTop5: number | null;
};

export type OverallMetrics = {
  top3MatchRate: number | null;
  top10MatchRate: number | null;
  citiesPassingTop3: number;
  citiesEvaluated: number;
};

export type MetricsOutput = {
  perCity: Record<string, CityMetrics>;
  overall: OverallMetrics;
};

const MATCH_THRESHOLD_LIKERT = 4;
const TOP3_PASS_BAR = 0.75;

export function isMatch(likert: number): boolean {
  return likert >= MATCH_THRESHOLD_LIKERT;
}

export function computeMetrics(
  evaluations: EvaluationInput[],
  modelTop5ByCity: Record<string, string[]>
): MetricsOutput {
  const submitted = evaluations.filter((e) => e.submittedAt != null);
  const byCity = new Map<string, EvaluationInput[]>();
  for (const e of submitted) {
    if (!byCity.has(e.cityId)) byCity.set(e.cityId, []);
    byCity.get(e.cityId)!.push(e);
  }

  const perCity: Record<string, CityMetrics> = {};
  const overallTop3Rates: number[] = [];
  const overallTop10Rates: number[] = [];

  for (const [cityId, evals] of byCity.entries()) {
    // Per-expert match rates for top 3 and top 10
    const expertTop3Rates: number[] = [];
    const expertTop10Rates: number[] = [];
    for (const ev of evals) {
      const top3 = ev.ratings.filter((r) => r.modelRank >= 1 && r.modelRank <= 3);
      const top10 = ev.ratings.filter((r) => r.modelRank >= 1 && r.modelRank <= 10);
      if (top3.length === 0 || top10.length === 0) continue;
      const top3Matches = top3.filter((r) => isMatch(r.likert)).length;
      const top10Matches = top10.filter((r) => isMatch(r.likert)).length;
      expertTop3Rates.push(top3Matches / top3.length);
      expertTop10Rates.push(top10Matches / top10.length);
    }

    const top3MatchRate = mean(expertTop3Rates);
    const top10MatchRate = mean(expertTop10Rates);

    // Spearman top-5 across experts who reordered
    const modelTop5 = modelTop5ByCity[cityId] ?? [];
    const spearmans: number[] = [];
    for (const ev of evals) {
      if (!ev.reorderTop5 || ev.reorderTop5.length !== 5 || modelTop5.length !== 5) continue;
      const rho = spearmanRho(modelTop5, ev.reorderTop5);
      if (!Number.isNaN(rho)) spearmans.push(rho);
    }

    perCity[cityId] = {
      expertsCompleted: evals.length,
      top3MatchRate,
      top10MatchRate,
      spearmanTop5: mean(spearmans),
    };
    if (top3MatchRate != null) overallTop3Rates.push(top3MatchRate);
    if (top10MatchRate != null) overallTop10Rates.push(top10MatchRate);
  }

  const citiesPassingTop3 = Object.values(perCity).filter(
    (m) => m.top3MatchRate != null && m.top3MatchRate >= TOP3_PASS_BAR
  ).length;

  return {
    perCity,
    overall: {
      top3MatchRate: mean(overallTop3Rates),
      top10MatchRate: mean(overallTop10Rates),
      citiesPassingTop3,
      citiesEvaluated: Object.keys(perCity).length,
    },
  };
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Spearman rank correlation for two orderings of the SAME 5 actionIds.
 * If `expert` contains an actionId not in `model`, or vice versa, returns NaN.
 * Returns a value in [-1, 1].
 */
export function spearmanRho(model: string[], expert: string[]): number {
  if (model.length !== expert.length) return NaN;
  const n = model.length;
  // Build rank maps: rank 1 = first in the list
  const modelRank = new Map<string, number>();
  model.forEach((id, idx) => modelRank.set(id, idx + 1));
  const expertRank = new Map<string, number>();
  expert.forEach((id, idx) => expertRank.set(id, idx + 1));

  // Confirm same elements
  for (const id of model) if (!expertRank.has(id)) return NaN;
  for (const id of expert) if (!modelRank.has(id)) return NaN;

  let sumD2 = 0;
  for (const id of model) {
    const d = (modelRank.get(id) as number) - (expertRank.get(id) as number);
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}
