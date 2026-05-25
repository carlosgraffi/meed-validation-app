/**
 * Headline metric computation for the CORFO contract.
 *
 * Methodology (post-2026-05-12 refactor; reveal stages added 2026-05-25,
 * repositioned to AFTER Stage 3 on 2026-05-25 to preserve Spearman blindness):
 *
 * Stage pipeline:
 *   stage1   blind  P@3
 *   stage2   blind  P@10
 *   sectionC blind  missing-actions (optional, side task)
 *   stage3   blind  Spearman ρ (top-5 reorder)
 *   reveal1  open   top-3 with LLM rationale → 1-5 agreement Likert
 *   reveal2  open   full top-10 with LLM rationale → 1-5 agreement Likert
 *   sectionE        free-text comment
 *
 *   - **Precision@3** — `question === 'top3'`, ranks 1..3. Blind: no rank order
 *     or LLM rationale exposed at this point.
 *   - **Precision@10** — `question === 'top10'`, all ranks 1..10. Symmetric
 *     re-rating of the top-3 against the top-10 question prevents
 *     "this is top-3-worthy" judgements from leaking into "is this top-10?".
 *     Still blind: top-3 order has NOT been revealed yet.
 *   - **Spearman ρ** — Stage 3 drag-reorder of the top-5. The model's order is
 *     the starting point (by design — this is "reorder if you disagree"), but
 *     the LLM rationale has not been shown yet, so the reorder isn't "persuaded".
 *   - **Top-3 ranking agreement** — collected on Reveal-1 after Stage 3
 *     completes. The expert sees the model's top-3 order + LLM rationale for
 *     the first time and answers a 1-5 "how much do you agree with this
 *     ranking as a whole?" Likert. Measures how persuasive the model's
 *     reasoning is once finally shown.
 *   - **Top-10 ranking agreement** — same on Reveal-2 / full top-10.
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
  // Post-reveal overall agreement Likerts. Null when the expert never reached
  // the corresponding reveal stage (mostly: pre-2026-05-25 evaluations).
  top3Agreement?: number | null;  // 1..5
  top10Agreement?: number | null; // 1..5
};

export type CityMetrics = {
  expertsCompleted: number;
  top3MatchRate: number | null;
  top10MatchRate: number | null;
  spearmanTop5: number | null;
  // Mean post-reveal ranking-agreement Likerts across submitted evaluations.
  // Null if no expert reached the corresponding reveal yet.
  top3AgreementMean: number | null;  // 1..5 scale
  top10AgreementMean: number | null; // 1..5 scale
  // Match-rate-style framing on the same Likert (≥4 counts as "agreed"), so
  // the reveal signal can be read on the same axis as P@3 / P@10.
  top3AgreementRate: number | null;  // share of experts with Likert >= 4
  top10AgreementRate: number | null; // share of experts with Likert >= 4
};

export type OverallMetrics = {
  top3MatchRate: number | null;
  top10MatchRate: number | null;
  citiesPassingTop3: number;
  citiesPassingTop10: number;
  citiesEvaluated: number;
  // Aggregate post-reveal signals (mean of per-city means).
  top3AgreementMean: number | null;
  top10AgreementMean: number | null;
  top3AgreementRate: number | null;
  top10AgreementRate: number | null;
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
    const top3Agreements: number[] = [];
    const top10Agreements: number[] = [];

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
      // Post-reveal agreements (1..5). Pre-reveal evaluations leave these null.
      if (ev.top3Agreement != null) top3Agreements.push(ev.top3Agreement);
      if (ev.top10Agreement != null) top10Agreements.push(ev.top10Agreement);
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
      top3AgreementMean: mean(top3Agreements),
      top10AgreementMean: mean(top10Agreements),
      // "Agreement rate" reads the same Likert on the match-or-not axis as
      // P@3 / P@10, so the reveal signal can sit alongside set-membership on
      // the admin dashboard without a unit mismatch.
      top3AgreementRate: agreementRate(top3Agreements),
      top10AgreementRate: agreementRate(top10Agreements),
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
      top3AgreementMean: mean(cityValues.map((m) => m.top3AgreementMean).filter(notNull)),
      top10AgreementMean: mean(cityValues.map((m) => m.top10AgreementMean).filter(notNull)),
      top3AgreementRate: mean(cityValues.map((m) => m.top3AgreementRate).filter(notNull)),
      top10AgreementRate: mean(cityValues.map((m) => m.top10AgreementRate).filter(notNull)),
    },
  };
}

/** Share of agreement Likerts at or above the match threshold (>=4). Same
 *  4-or-5 rule as `isMatch` so post-reveal agreement reads on the same axis. */
function agreementRate(likerts: number[]): number | null {
  if (likerts.length === 0) return null;
  return likerts.filter((l) => l >= MATCH_THRESHOLD_LIKERT).length / likerts.length;
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
