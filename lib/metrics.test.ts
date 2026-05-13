import { describe, it, expect } from "vitest";
import { computeMetrics, spearmanRho, isMatch, type RatingInput } from "./metrics";

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

/**
 * Helper builders for ratings — produce both top3 and top10 question rows
 * cleanly without verbose object literals.
 */
function top3Rating(rank: number, likert: number, notSure = false): RatingInput {
  return { actionId: `a${rank}`, modelRank: rank, question: "top3", likert, notSure };
}
function top10Rating(rank: number, likert: number, notSure = false): RatingInput {
  return { actionId: `a${rank}`, modelRank: rank, question: "top10", likert, notSure };
}

describe("computeMetrics — three-stage methodology", () => {
  describe("hand-built fixture: 2 experts, 1 city, full top3+top10 coverage", () => {
    // Expert E1 — top-3 question answers for ranks 1..3
    // Then top-10 question answers for ranks 1..10 (including a re-rate of the top 3)
    const E1_top3 = [top3Rating(1, 5), top3Rating(2, 5), top3Rating(3, 4)]; // 3/3 match
    const E1_top10 = [
      top10Rating(1, 5),
      top10Rating(2, 5),
      top10Rating(3, 4),
      top10Rating(4, 3),
      top10Rating(5, 3),
      top10Rating(6, 3),
      top10Rating(7, 3),
      top10Rating(8, 3),
      top10Rating(9, 3),
      top10Rating(10, 3),
    ]; // 3/10 match

    const E2_top3 = [top3Rating(1, 5), top3Rating(2, 4), top3Rating(3, 3)]; // 2/3 match
    const E2_top10 = [
      top10Rating(1, 5),
      top10Rating(2, 4),
      top10Rating(3, 3),
      top10Rating(4, 4),
      top10Rating(5, 3),
      top10Rating(6, 3),
      top10Rating(7, 3),
      top10Rating(8, 3),
      top10Rating(9, 3),
      top10Rating(10, 3),
    ]; // 3/10 match

    const evals = [
      {
        expertId: "E1",
        cityId: "C1",
        submittedAt: new Date(),
        ratings: [...E1_top3, ...E1_top10],
        reorderTop5: ["a1", "a2", "a3", "a4", "a5"],
      },
      {
        expertId: "E2",
        cityId: "C1",
        submittedAt: new Date(),
        ratings: [...E2_top3, ...E2_top10],
        reorderTop5: ["a2", "a1", "a3", "a4", "a5"],
      },
    ];
    const result = computeMetrics(evals, { C1: ["a1", "a2", "a3", "a4", "a5"] });

    it("computes top3MatchRate from top3 question ratings only", () => {
      // E1: 1.0; E2: 2/3 → mean 0.833
      expect(result.perCity.C1.top3MatchRate).toBeCloseTo((1 + 2 / 3) / 2, 5);
    });

    it("computes top10MatchRate from top10 question ratings only", () => {
      // E1: 3/10 = 0.3; E2: 3/10 = 0.3 → mean 0.3
      expect(result.perCity.C1.top10MatchRate).toBeCloseTo(0.3, 5);
    });

    it("counts experts completed", () => {
      expect(result.perCity.C1.expertsCompleted).toBe(2);
    });

    it("flags city as passing the top-3 bar", () => {
      expect(result.overall.citiesPassingTop3).toBe(1);
    });

    it("computes citiesPassingTop10 in parallel with citiesPassingTop3", () => {
      // Top-10 rate is 0.3 — below 0.75 → 0 cities pass
      expect(result.overall.citiesPassingTop10).toBe(0);
    });

    it("computes Spearman top-5 mean across reorders", () => {
      expect(result.perCity.C1.spearmanTop5).toBeCloseTo((1 + 0.9) / 2, 5);
    });

    it("excludes evaluations that have not been submitted", () => {
      const withDraft = [
        ...evals,
        {
          expertId: "E3",
          cityId: "C1",
          submittedAt: null,
          ratings: [top3Rating(1, 1), top3Rating(2, 1), top3Rating(3, 1)],
          reorderTop5: null,
        },
      ];
      const r = computeMetrics(withDraft, { C1: ["a1", "a2", "a3", "a4", "a5"] });
      expect(r.perCity.C1.expertsCompleted).toBe(2);
    });
  });

  describe("symmetric questioning: top-3 miss but top-10 match (the case the refactor was designed for)", () => {
    // A single expert who thinks the model's #2 action belongs in the top 10 but
    // NOT in the top 3 — they'd swap it for something else for the top 3.
    // Old positional-Likert methodology would have counted this as a single
    // ambiguous rating; new methodology captures both signals cleanly.
    const evals = [
      {
        expertId: "E1",
        cityId: "C1",
        submittedAt: new Date(),
        ratings: [
          // Stage 1 — top-3 question
          top3Rating(1, 5), // strong agreement
          top3Rating(2, 2), // disagrees: shouldn't be in top 3
          top3Rating(3, 5), // strong agreement
          // Stage 2 — top-10 question (re-rate including ranks 1..3)
          top10Rating(1, 5),
          top10Rating(2, 5), // YES this action belongs in top 10 — just not top 3
          top10Rating(3, 5),
          top10Rating(4, 5),
          top10Rating(5, 5),
          top10Rating(6, 5),
          top10Rating(7, 5),
          top10Rating(8, 5),
          top10Rating(9, 5),
          top10Rating(10, 5),
        ],
        reorderTop5: null,
      },
    ];
    const result = computeMetrics(evals, { C1: ["a1", "a2", "a3", "a4", "a5"] });

    it("top3 miss is recorded: action a2 counts against Precision@3", () => {
      // E1 top-3: 2/3 match (a1 and a3 only)
      expect(result.perCity.C1.top3MatchRate).toBeCloseTo(2 / 3, 5);
    });

    it("but top10 match is preserved: action a2 counts toward Precision@10", () => {
      // E1 top-10: 10/10 match (every rank rated >=4)
      expect(result.perCity.C1.top10MatchRate).toBeCloseTo(1.0, 5);
    });

    it("the two metrics are computed independently — top3 fail does not drag top10 down", () => {
      const m = result.perCity.C1;
      expect(m.top3MatchRate).toBeLessThan(0.75); // city fails top-3 bar
      expect(m.top10MatchRate).toBeGreaterThanOrEqual(0.75); // city passes top-10 bar
      expect(result.overall.citiesPassingTop3).toBe(0);
      expect(result.overall.citiesPassingTop10).toBe(1);
    });
  });

  describe("partial completion — Stage 1 done but Stage 2 missing", () => {
    // Should produce top3 rate but null top10 rate
    const evals = [
      {
        expertId: "E1",
        cityId: "C1",
        submittedAt: new Date(),
        ratings: [top3Rating(1, 5), top3Rating(2, 4), top3Rating(3, 4)],
        reorderTop5: null,
      },
    ];
    const r = computeMetrics(evals, { C1: ["a1", "a2", "a3", "a4", "a5"] });
    it("returns top3MatchRate even without top10 data", () => {
      expect(r.perCity.C1.top3MatchRate).toBeCloseTo(1.0, 5);
    });
    it("returns null top10MatchRate when no top10 ratings exist", () => {
      expect(r.perCity.C1.top10MatchRate).toBeNull();
    });
  });
});
