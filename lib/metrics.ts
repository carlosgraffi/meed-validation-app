/**
 * Headline metric computation for the CORFO contract.
 *
 * Methodology (post-2026-05-12 refactor):
 *   - **Precision@3** uses ratings where `question === 'top3'` for the model's top-3
 *     actions only (ranks 1..3). Asks "is this action in the top 3?".
 *   - **Precision@10** uses ratings where `question === 'top10'` for ALL 10 actions
 *     (including the top 3 — symmetric questioning). Asks "is this action in the top 10?".
 *   - **Spearman ρ** is computed over Stage 3 reorders (top 5 only).
 *
 * Precision@K is "set membership", not "positional agreement". An action can be a
 * Precision@3 miss but a Precision@10 match — this is the case the refactor was
 * designed to capture without bias.
 *
 * Both Precision@3 and Precision@10 carry the same headline weight. Top-3 is the
 * contract bar (≥75%); top-10 is more stable (≈50 ratings per city vs ≈15 for top-3)
 * and the team treats them as a paired read.
 *
 * Only SUBMITTED evaluations count (submittedAt is non-null).
 *
 * Pure function — no DB, no side effects — so the tests in lib/metrics.test.ts can
 * pin down behavior against hand-built fixtures.
 */

export type RatingInput = {
  actionId: string;
  modelRank: number; // 1..10
  question: "top3" | "top10";
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
  citiesPassingTop10: number;
  citiesEvaluated: number;
};

export type MetricsOutput = {
  perCity: Record<string, CityMetrics>;
  overall: OverallMetrics;
};

const MATCH_THRESHOLD_LIKERT = 4;
const PASS_BAR = 0.75;

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

  for (const [cityId, evals] of byCity.entries()) {
    const expertTop3Rates: number[] = [];
    const expertTop10Rates: number[] = [];

    for (const ev of evals) {
      // Stage 1 ratings — set membership for the model's top 3.
      const top3Ratings = ev.ratings.filter(
        (r) => r.question === "top3" && r.modelRank >= 1 && r.modelRank <= 3
      );
      // Stage 2 ratings — set membership for the model's top 10 (covers all ranks 1..10).
      const top10Ratings = ev.ratings.filter(
        (r) => r.question === "top10" && r.modelRank >= 1 && r.modelRank <= 10
      );

      if (top3Ratings.length > 0) {
        const matches = top3Ratings.filter((r) => isMatch(r.likert)).length;
        expertTop3Rates.push(matches / top3Ratings.length);
      }
      if (top10Ratings.length > 0) {
        const matches = top10Ratings.filter((r) => isMatch(r.likert)).length;
        expertTop10Rates.push(matches / top10Ratings.length);
      }
    }

    // Spearman across experts who completed Stage 3 reorder.
    const modelTop5 = modelTop5ByCity[cityId] ?? [];
    const spearmans: number[] = [];
    for (const ev of evals) {
      if (!ev.reorderTop5 || ev.reorderTop5.length !== 5 || modelTop5.length !== 5) continue;
      const rho = spearmanRho(modelTop5, ev.reorderTop5);
      if (!Number.isNaN(rho)) spearmans.push(rho);
    }

    perCity[cityId] = {
      expertsCompleted: evals.length,
      top3MatchRate: mean(expertTop3Rates),
      top10MatchRate: mean(expertTop10Rates),
      spearmanTop5: mean(spearmans),
    };
  }

  const cityValues = Object.values(perCity);
  const citiesPassingTop3 = cityValues.filter(
    (m) => m.top3MatchRate != null && m.top3MatchRate >= PASS_BAR
  ).length;
  const citiesPassingTop10 = cityValues.filter(
    (m) => m.top10MatchRate != null && m.top10MatchRate >= PASS_BAR
  ).length;

  return {
    perCity,
    overall: {
      top3MatchRate: mean(cityValues.map((m) => m.top3MatchRate).filter(notNull)),
      top10MatchRate: mean(cityValues.map((m) => m.top10MatchRate).filter(notNull)),
      citiesPassingTop3,
      citiesPassingTop10,
      citiesEvaluated: cityValues.length,
    },
  };
}

function notNull<T>(x: T | null): x is T {
  return x !== null;
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
  const modelRank = new Map<string, number>();
  model.forEach((id, idx) => modelRank.set(id, idx + 1));
  const expertRank = new Map<string, number>();
  expert.forEach((id, idx) => expertRank.set(id, idx + 1));

  for (const id of model) if (!expertRank.has(id)) return NaN;
  for (const id of expert) if (!modelRank.has(id)) return NaN;

  let sumD2 = 0;
  for (const id of model) {
    const d = (modelRank.get(id) as number) - (expertRank.get(id) as number);
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}
