/**
 * Read-only diagnostic: prints the current DB state and the deployed
 * fixture state side-by-side. Use when /evaluate/<cityId> is 404'ing and
 * you want to figure out which of the three notFound() calls fired:
 *   1. assignment row missing  → demo or panel needs a reseed
 *   2. cityId not in cities.json on disk  → stale deploy
 *   3. cityId not in model_outputs.json on disk  → stale deploy
 *
 * Usage:
 *   railway run npx tsx scripts/inspect-db.ts            # against prod
 *   npx tsx scripts/inspect-db.ts                        # against local
 */
import { PrismaClient } from "@prisma/client";
import { loadCities, loadModelOutputs, loadExperts } from "../lib/fixtures";

const prisma = new PrismaClient();

async function main() {
  // ── DB ───────────────────────────────────────────────────────────────
  const allExperts = await prisma.expert.findMany({
    include: {
      assignments: { orderBy: { cityId: "asc" } },
      _count: { select: { magicTokens: true, evaluations: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`\n=== DB: ${allExperts.length} expert rows ===`);
  for (const e of allExperts) {
    const flag = e.consentedAt ? "✓consented" : "·";
    const assignments = e.assignments.length
      ? e.assignments.map((a) => a.cityId).join(", ")
      : "(none)";
    console.log(
      `  ${e.id.padEnd(20)}  ${flag}  evals=${e._count.evaluations}  tokens=${e._count.magicTokens}`
    );
    console.log(`    email: ${e.email}`);
    console.log(`    assignments: ${assignments}`);
  }

  const totalAssignments = await prisma.assignment.count();
  console.log(`\n  → Total assignments: ${totalAssignments}`);

  // ── Fixtures on disk in this build ───────────────────────────────────
  console.log(`\n=== Fixture: cities.json on this filesystem ===`);
  const cities = loadCities();
  for (const c of cities) {
    console.log(`  ${c.cityId.padEnd(8)}  ${c.displayName}  (${c.totalEmissions} t CO2e)`);
  }

  console.log(`\n=== Fixture: model_outputs.json on this filesystem ===`);
  const outputs = loadModelOutputs();
  for (const cityId of Object.keys(outputs)) {
    console.log(`  ${cityId.padEnd(8)}  topActions=${outputs[cityId].topActions.length}`);
  }

  console.log(`\n=== Fixture: experts.json on this filesystem ===`);
  const fixtureExperts = loadExperts();
  console.log(`  ${fixtureExperts.length} expert(s) in experts.json`);

  // ── Cross-check ──────────────────────────────────────────────────────
  console.log(`\n=== Cross-check ===`);
  const cityIds = new Set(cities.map((c) => c.cityId));
  const orphanAssignments = await prisma.assignment.findMany({
    where: { cityId: { notIn: Array.from(cityIds) } },
    select: { expertId: true, cityId: true },
  });
  if (orphanAssignments.length > 0) {
    console.log(
      `  ⚠ ${orphanAssignments.length} ORPHAN assignments (cityId not in cities.json):`
    );
    for (const a of orphanAssignments.slice(0, 10)) {
      console.log(`    ${a.expertId} → ${a.cityId}`);
    }
    if (orphanAssignments.length > 10) {
      console.log(`    … and ${orphanAssignments.length - 10} more`);
    }
  } else {
    console.log(`  ✓ no orphan assignments`);
  }

  const demoExpert = allExperts.find((e) => e.id === "demo");
  if (!demoExpert) {
    console.log(`  ⚠ demo expert NOT in DB`);
  } else {
    const demoCities = demoExpert.assignments.map((a) => a.cityId).sort();
    const expectedDemo = ["CL PAO", "CL RNC", "CL ZAL"];
    const match =
      demoCities.length === expectedDemo.length &&
      demoCities.every((c, i) => c === expectedDemo[i]);
    console.log(
      `  ${match ? "✓" : "⚠"} demo expert cities: [${demoCities.join(", ")}] ${
        match ? "" : `(expected [${expectedDemo.join(", ")}])`
      }`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
