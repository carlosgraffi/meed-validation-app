import { describe, it, expect } from "vitest";
import { splitInputsByCohort, summarizeExperts } from "./cohorts";
import type { EvaluationInput } from "./metrics";

// Cohort cutoff used by the app: end of Sunday 7 Jun 2026 in Chile (UTC-4).
const CUTOFF = Date.parse("2026-06-08T04:00:00.000Z");

function ev(expertId: string, cityId: string, submittedAt: string | null): EvaluationInput {
  return { expertId, cityId, submittedAt, ratings: [] };
}

describe("splitInputsByCohort", () => {
  it("assigns an expert to Cohort 1 by their FIRST submission, and keeps ALL their evals there", () => {
    const inputs = [
      // Expert A: first city submitted Friday → Cohort 1; second city Saturday
      // must ALSO land in Cohort 1 (expert-level cohorting).
      ev("A", "CL PAO", "2026-06-05T15:00:00Z"),
      ev("A", "CL RNC", "2026-06-06T18:00:00Z"),
      // Expert B: only submission is Monday → Cohort 2.
      ev("B", "CL PAO", "2026-06-08T13:00:00Z"),
      // Expert C: first (only) submission Sunday → still Cohort 1 (Sunday cutoff).
      ev("C", "CL ZAL", "2026-06-07T20:00:00Z"),
    ];

    const { cohort1, cohort2, cohort1ExpertIds, cohort2ExpertIds } =
      splitInputsByCohort(inputs, CUTOFF);

    expect(cohort1ExpertIds).toEqual(["A", "C"]);
    expect(cohort2ExpertIds).toEqual(["B"]);
    // Both of A's cities stay together in Cohort 1.
    expect(cohort1.filter((e) => e.expertId === "A")).toHaveLength(2);
    expect(cohort1).toHaveLength(3); // A×2 + C×1
    expect(cohort2).toHaveLength(1); // B×1
  });

  it("treats the cutoff as exclusive (a submission exactly at the cutoff is Cohort 2)", () => {
    const inputs = [ev("D", "CL PAO", "2026-06-08T04:00:00.000Z")];
    const { cohort1ExpertIds, cohort2ExpertIds } = splitInputsByCohort(inputs, CUTOFF);
    expect(cohort1ExpertIds).toEqual([]);
    expect(cohort2ExpertIds).toEqual(["D"]);
  });

  it("partitions every submitted eval into exactly one cohort (total = c1 + c2)", () => {
    const inputs = [
      ev("A", "CL PAO", "2026-06-05T10:00:00Z"),
      ev("A", "CL RNC", "2026-06-09T10:00:00Z"),
      ev("B", "CL PAO", "2026-06-08T10:00:00Z"),
      ev("C", "CL ZAL", "2026-06-07T10:00:00Z"),
    ];
    const { cohort1, cohort2 } = splitInputsByCohort(inputs, CUTOFF);
    expect(cohort1.length + cohort2.length).toBe(inputs.length);
  });

  it("ignores rows with a null submittedAt", () => {
    const inputs = [ev("A", "CL PAO", null), ev("A", "CL RNC", "2026-06-06T10:00:00Z")];
    const { cohort1, cohort2 } = splitInputsByCohort(inputs, CUTOFF);
    expect(cohort1).toHaveLength(1);
    expect(cohort2).toHaveLength(0);
  });
});

describe("summarizeExperts", () => {
  it("rolls evals up per expert with city count, earliest submission, and resolved name", () => {
    const inputs = [
      ev("A", "CL PAO", "2026-06-06T18:00:00Z"),
      ev("A", "CL RNC", "2026-06-05T15:00:00Z"), // earlier — should win firstSubmittedAt
      ev("B", "CL ZAL", "2026-06-07T20:00:00Z"),
    ];
    const names = new Map([
      ["A", "Ana Jara"],
      ["B", "Bruno Campos"],
    ]);
    const rows = summarizeExperts(inputs, names);

    expect(rows.map((r) => r.fullName)).toEqual(["Ana Jara", "Bruno Campos"]); // sorted by name
    const ana = rows.find((r) => r.expertId === "A")!;
    expect(ana.citiesSubmitted).toBe(2);
    expect(ana.firstSubmittedAt).toBe("2026-06-05T15:00:00.000Z");
    expect(rows.find((r) => r.expertId === "B")!.citiesSubmitted).toBe(1);
  });

  it("falls back to the expert id when no name is known and skips null submissions", () => {
    const inputs = [ev("Z", "CL PAO", null), ev("Z", "CL RNC", "2026-06-06T10:00:00Z")];
    const rows = summarizeExperts(inputs, new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ expertId: "Z", fullName: "Z", citiesSubmitted: 1 });
  });
});
