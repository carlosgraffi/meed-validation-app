/**
 * Expert-level cohort split for the admin metrics view.
 *
 * A cohort is decided per EXPERT by the timestamp of their FIRST submitted
 * city-evaluation (not by completing all assigned cities). An expert who
 * submitted at least one city before the cutoff lands in Cohort 1, and ALL of
 * that expert's submitted evaluations are counted in Cohort 1 — including
 * cities they finished after the cutoff. Cohort 2 is every other submitting
 * expert (first submission at/after the cutoff).
 *
 * Pure function — no DB, no side effects — so the partition is unit-testable
 * and the live numbers are never mutated; we only re-bucket the same rows that
 * computeMetrics() already consumes.
 */
import type { EvaluationInput } from "./metrics";

export type CohortSplit = {
  cohort1: EvaluationInput[];
  cohort2: EvaluationInput[];
  cohort1ExpertIds: string[];
  cohort2ExpertIds: string[];
};

/** One participant's footprint within a cohort, for the admin roster. */
export type CohortExpert = {
  expertId: string;
  fullName: string;
  citiesSubmitted: number;
  firstSubmittedAt: string | null;
};

/**
 * Roll a set of submitted evaluations up to one row per expert: how many
 * cities they submitted and when they first submitted. Pure — names are
 * resolved through the supplied map (falls back to the id if unknown).
 * Sorted by name for a stable roster.
 */
export function summarizeExperts(
  inputs: EvaluationInput[],
  nameById: Map<string, string>
): CohortExpert[] {
  const byExpert = new Map<string, { count: number; firstMs: number }>();
  for (const e of inputs) {
    if (e.submittedAt == null) continue;
    const t = new Date(e.submittedAt).getTime();
    const cur = byExpert.get(e.expertId);
    if (!cur) byExpert.set(e.expertId, { count: 1, firstMs: t });
    else {
      cur.count += 1;
      if (t < cur.firstMs) cur.firstMs = t;
    }
  }
  return [...byExpert.entries()]
    .map(([expertId, v]) => ({
      expertId,
      fullName: nameById.get(expertId) ?? expertId,
      citiesSubmitted: v.count,
      firstSubmittedAt: Number.isFinite(v.firstMs)
        ? new Date(v.firstMs).toISOString()
        : null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Partition submitted evaluations into two cohorts by each expert's earliest
 * submission. `cutoffMs` is the EXCLUSIVE upper bound for Cohort 1 (i.e. a
 * submission exactly at the cutoff falls into Cohort 2).
 *
 * Rows with a null submittedAt are ignored for cohort assignment (they don't
 * count toward metrics anyway), but are dropped from the output so both
 * cohorts contain only submitted evaluations.
 */
export function splitInputsByCohort(
  inputs: EvaluationInput[],
  cutoffMs: number
): CohortSplit {
  const firstByExpert = new Map<string, number>();
  for (const e of inputs) {
    if (e.submittedAt == null) continue;
    const t = new Date(e.submittedAt).getTime();
    const prev = firstByExpert.get(e.expertId);
    if (prev === undefined || t < prev) firstByExpert.set(e.expertId, t);
  }

  const cohort1Set = new Set<string>();
  for (const [expertId, firstMs] of firstByExpert) {
    if (firstMs < cutoffMs) cohort1Set.add(expertId);
  }

  const submitted = inputs.filter((e) => e.submittedAt != null);
  return {
    cohort1: submitted.filter((e) => cohort1Set.has(e.expertId)),
    cohort2: submitted.filter((e) => !cohort1Set.has(e.expertId)),
    cohort1ExpertIds: [...cohort1Set].sort(),
    cohort2ExpertIds: [...firstByExpert.keys()]
      .filter((id) => !cohort1Set.has(id))
      .sort(),
  };
}
