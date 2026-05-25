import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";

/**
 * One-shot admin endpoint that runs the same migration as
 * scripts/migrate-stage-order.ts but inside the Railway container (where
 * the volume-backed SQLite actually lives — `railway run` can't reach it
 * from a local laptop).
 *
 * Idempotent: rerunning returns counts=0 once values have been migrated.
 * Safe to call multiple times. Designed for a single use immediately after
 * the 2026-05-25 stage-order refactor lands.
 *
 * See the script for the full rationale; in short: `reveal1` / `reveal2`
 * meant something different under the old order, so in-flight evaluations
 * with those values need to be re-pointed to their new equivalents.
 */
const REMAP: Record<string, string> = {
  reveal1: "stage2",
  reveal2: "sectionC",
};

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const inFlight = await prisma.evaluation.findMany({
    where: {
      submittedAt: null,
      currentStage: { in: Object.keys(REMAP) },
    },
    select: {
      id: true,
      expertId: true,
      cityId: true,
      currentStage: true,
      top3Agreement: true,
      top10Agreement: true,
    },
  });

  const migrations = [];
  for (const e of inFlight) {
    const nextStage = REMAP[e.currentStage];
    await prisma.evaluation.update({
      where: { id: e.id },
      data: { currentStage: nextStage },
    });
    migrations.push({
      expertId: e.expertId,
      cityId: e.cityId,
      from: e.currentStage,
      to: nextStage,
      top3Agreement: e.top3Agreement,
      top10Agreement: e.top10Agreement,
    });
  }

  return NextResponse.json({
    ok: true,
    migrated: migrations.length,
    rows: migrations,
  });
}
