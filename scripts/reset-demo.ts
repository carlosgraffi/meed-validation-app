/**
 * Reset the demo expert's state to a clean slate. Wipes evaluations,
 * ratings, reorders, and onboarding so the next /demo/login starts
 * fresh on the onboarding page.
 *
 * Assignments are PRESERVED (re-created if needed via seed) so the
 * demo expert keeps their pre-configured 3 cities.
 *
 * Usage (local):
 *   npx tsx scripts/reset-demo.ts
 *
 * Usage (Railway): there's an admin endpoint POST /api/admin/reset-demo
 * that does the same thing — call it from the admin dashboard.
 */
import { PrismaClient } from "@prisma/client";
import { loadCities } from "../lib/fixtures";

const DEMO_CITIES = ["city_03", "city_05", "city_07", "city_10"];

const prisma = new PrismaClient();

async function main() {
  const demo = await prisma.expert.findUnique({
    where: { id: "demo" },
    include: { evaluations: { include: { ratings: true, reorderTop5: true } } },
  });
  if (!demo) {
    console.log("No demo expert in DB. Run `npm run seed` first.");
    return;
  }

  console.log(
    `→ Found demo expert (${demo.email}) with ${demo.evaluations.length} evaluation(s).`
  );

  // Cascading deletes wipe ratings + reorderTop5 automatically. We also
  // explicitly delete evaluations to be safe across schema generations.
  let ratingsDeleted = 0;
  let reordersDeleted = 0;
  for (const ev of demo.evaluations) {
    ratingsDeleted += ev.ratings.length;
    if (ev.reorderTop5) reordersDeleted++;
  }
  await prisma.evaluation.deleteMany({ where: { expertId: "demo" } });
  console.log(
    `  ✓ wiped ${demo.evaluations.length} evaluations, ${ratingsDeleted} ratings, ${reordersDeleted} reorders`
  );

  // Wipe any magic tokens too — they're not relevant for password-based demo
  // login, but if there are stale ones they'd confuse the picture.
  const tokens = await prisma.magicToken.deleteMany({ where: { expertId: "demo" } });
  if (tokens.count > 0) console.log(`  ✓ wiped ${tokens.count} stale magic tokens`);

  // Reset profile state so onboarding triggers again.
  await prisma.expert.update({
    where: { id: "demo" },
    data: {
      consentedAt: null,
      completedAt: null,
      preferredCityIds: null,
      fullName: "Demo Expert (sandbox)",
      sectorSpecialization: "Transversal",
    },
  });
  console.log(`  ✓ cleared consent, completion, and preferences`);

  // Re-ensure the demo cities are assigned (in case someone manipulated them).
  const cityIds = new Set(loadCities().map((c) => c.cityId));
  for (const cityId of DEMO_CITIES) {
    if (!cityIds.has(cityId)) {
      console.warn(`  ! demo city ${cityId} not in cities.json — skipping`);
      continue;
    }
    await prisma.assignment.upsert({
      where: { expertId_cityId: { expertId: "demo", cityId } },
      create: { expertId: "demo", cityId },
      update: {},
    });
  }
  console.log(`  ✓ ensured demo expert is assigned to ${DEMO_CITIES.join(", ")}`);

  console.log("✓ Done. Demo expert is reset to a clean slate.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
