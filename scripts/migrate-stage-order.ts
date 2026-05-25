/**
 * One-shot migration for the 2026-05-25 stage-order change.
 *
 * Before:  stage1 → reveal1 → stage2 → reveal2 → sectionC → stage3 → sectionE
 * After:   stage1 → stage2 → sectionC → stage3 → reveal1 → reveal2 → sectionE
 *
 * The reveals were repositioned to AFTER stage3 so all three headline metrics
 * (P@3, P@10, Spearman ρ) are collected before any LLM-rationale exposure.
 *
 * Effect on in-flight evaluations:
 *   - An expert sitting on `reveal1` had finished Stage 1 ratings; in the new
 *     order their natural next stage is `stage2`. Their `top3Agreement` value
 *     (if any) stays; they will overwrite it during the new Reveal-1 at the
 *     end of the flow, where the informed-agreement signal is actually
 *     measured.
 *   - An expert sitting on `reveal2` had finished Stage 1 + Stage 2; in the
 *     new order their natural next stage is `sectionC`. Same caveat about
 *     `top10Agreement`.
 *   - Submitted evaluations (`submittedAt != null`) are untouched — they're
 *     locked, and the final agreement values they captured are still valid
 *     readings (just collected at a different point in the pipeline).
 *
 * Run once after the deploy:
 *   railway run npx tsx scripts/migrate-stage-order.ts
 *
 * Idempotent: rerunning is a no-op once values have been migrated. Safe to
 * leave in the repo as a historical record.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REMAP: Record<string, string> = {
  reveal1: "stage2",
  reveal2: "sectionC",
};

async function main() {
  const inFlight = await prisma.evaluation.findMany({
    where: {
      submittedAt: null,
      currentStage: { in: Object.keys(REMAP) },
    },
    select: { id: true, expertId: true, cityId: true, currentStage: true, top3Agreement: true, top10Agreement: true },
  });

  if (inFlight.length === 0) {
    console.log("✓ No in-flight evaluations on the old reveal positions. Nothing to migrate.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${inFlight.length} in-flight evaluation(s) to migrate:`);
  for (const e of inFlight) {
    const next = REMAP[e.currentStage];
    console.log(
      `  ${e.expertId.padEnd(20)} ${e.cityId.padEnd(8)}  ` +
        `currentStage: ${e.currentStage} → ${next}  ` +
        `(top3A=${e.top3Agreement ?? "-"}, top10A=${e.top10Agreement ?? "-"})`
    );
    await prisma.evaluation.update({
      where: { id: e.id },
      data: { currentStage: next },
    });
  }

  console.log(`✓ Migrated ${inFlight.length} evaluation(s).`);
  console.log("  Agreement Likerts are preserved; experts will overwrite them");
  console.log("  during the new post-Stage-3 reveal stages.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
