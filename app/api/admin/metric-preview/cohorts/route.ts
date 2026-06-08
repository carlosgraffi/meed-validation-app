import { NextResponse } from "next/server";
import { requireAdmin } from "../../_guard";
import { computeCohortMetrics } from "@/lib/admin-metrics";

/**
 * Admin-only cohort breakdown of the live metrics. Read-only and additive —
 * it re-runs the same pure computeMetrics() over expert-level cohort subsets
 * (see lib/cohorts.ts). Does not touch stored data; `total` equals the legacy
 * /api/admin/metric-preview output.
 *
 * Cohort boundary: each expert's FIRST submission. Default cutoff is the end of
 * Sunday 7 Jun 2026 in Chile time (UTC-4) → 2026-06-08T04:00:00Z, overridable
 * via COHORT_CUTOFF_ISO without a code change.
 */
const DEFAULT_CUTOFF_ISO = "2026-06-08T04:00:00.000Z";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cutoffISO = process.env.COHORT_CUTOFF_ISO ?? DEFAULT_CUTOFF_ISO;
  const metrics = await computeCohortMetrics(cutoffISO);
  return NextResponse.json(metrics);
}
