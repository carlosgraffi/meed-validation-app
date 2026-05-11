import { describe, it, expect } from "vitest";
import { computeMetrics, spearmanRho, isMatch } from "./metrics";

describe("isMatch", () => {
  it("returns true for Likert 4 and 5, false otherwise", () => {
    expect(isMatch(1)).toBe(false);
    expect(isMatch(2)).toBe(false);
    expect(isMatch(3)).toBe(false);
    expect(isMatch(4)).toBe(true);
    expect(isMatch(5)).toBe(true);
  });
});

describe("spearmanRho", () => {
  it("returns 1 for identical orderings", () => {
    expect(spearmanRho(["a", "b", "c", "d", "e"], ["a", "b", "c", "d", "e"])).toBe(1);
  });
  it("returns -1 for fully reversed orderings", () => {
    expect(spearmanRho(["a", "b", "c", "d", "e"], ["e", "d", "c", "b", "a"])).toBe(-1);
  });
  it("returns NaN if elements differ", () => {
    expect(Number.isNaN(spearmanRho(["a", "b", "c", "d", "e"], ["a", "b", "c", "d", "x"]))).toBe(true);
  });
});

describe("computeMetrics — hand-built fixture matches Section 1 operational definition", () => {
  // City C1, model top 3 = [a1, a2, a3], top 10 = a1..a10.
  // 2 experts evaluate.
  //
  // Expert E1 ratings: 5,5,4,3,3,3,3,3,3,3.
  //   Top-3 matches (Likert ≥ 4) = 3/3 = 1.0
  //   Top-10 matches              = 3/10 = 0.3
  //
  // Expert E2 ratings: 5,4,3,4,3,3,3,3,3,3.
  //   Top-3 matches = 2/3 (ranks 1 and 2 match; rank 3 is Likert 3)
  //   Top-10 matches = 3/10 (ranks 1, 2, 4 match)
  //
  // City top-3 = (1.0 + 2/3) / 2 = 0.833 → passes 0.75 bar.
  // City top-10 = (0.3 + 0.3) / 2 = 0.3.
  const ratings = (likerts: number[]) =>
    likerts.map((l, i) => ({
      actionId: `a${i + 1}`,
      modelRank: i + 1,
      likert: l,
      notSure: false,
    }));

  const evals = [
    {
      expertId: "E1",
      cityId: "C1",
      submittedAt: new Date(),
      ratings: ratings([5, 5, 4, 3, 3, 3, 3, 3, 3, 3]),
      reorderTop5: ["a1", "a2", "a3", "a4", "a5"], // identical → Spearman 1
    },
    {
      expertId: "E2",
      cityId: "C1",
      submittedAt: new Date(),
      ratings: ratings([5, 4, 3, 4, 3, 3, 3, 3, 3, 3]),
      reorderTop5: ["a2", "a1", "a3", "a4", "a5"], // one swap
    },
  ];

  const result = computeMetrics(evals, { C1: ["a1", "a2", "a3", "a4", "a5"] });

  it("top3MatchRate per city is averaged correctly", () => {
    expect(result.perCity.C1.top3MatchRate).toBeCloseTo((1.0 + 2 / 3) / 2, 5);
  });
  it("top10MatchRate per city is averaged correctly", () => {
    // E1: 3/10 = 0.3, E2: 3/10 = 0.3 → avg 0.3
    expect(result.perCity.C1.top10MatchRate).toBeCloseTo(0.3, 5);
  });
  it("counts experts completed", () => {
    expect(result.perCity.C1.expertsCompleted).toBe(2);
  });
  it("flags city as passing the 75% top-3 bar", () => {
    expect(result.overall.citiesPassingTop3).toBe(1);
  });
  it("computes Spearman top-5 mean across reorders", () => {
    // E1 identical = 1; E2 swap of positions 1↔2: sumD² = 1+1 = 2, rho = 1 - 6*2/(5*24) = 1 - 12/120 = 0.9
    expect(result.perCity.C1.spearmanTop5).toBeCloseTo((1 + 0.9) / 2, 5);
  });
  it("excludes evaluations that have not been submitted", () => {
    const withDraft = [
      ...evals,
      {
        expertId: "E3",
        cityId: "C1",
        submittedAt: null,
        ratings: ratings([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        reorderTop5: null,
      },
    ];
    const r = computeMetrics(withDraft, { C1: ["a1", "a2", "a3", "a4", "a5"] });
    expect(r.perCity.C1.expertsCompleted).toBe(2);
  });
});
