/**
 * Seeds the SQLite DB from the JSON fixtures in /data.
 *
 * - Idempotent for Experts and Assignments: re-running upserts experts but does NOT
 *   regenerate Assignments (those come from the admin "Run stratification" button or
 *   a manual `npm run seed -- --stratify` flag).
 * - Validates fixtures with Zod (lib/fixtures.ts) before touching the DB; fails fast.
 * - Cities, Actions, ModelOutputs are NOT stored in the DB — they live in JSON, and we
 *   read them at request time from /data. The DB only holds expert/eval state.
 *
 * Flags:
 *   --stratify    also run stratification and write Assignments (overwrites existing
 *                 assignments only for experts whose evaluations have not been started)
 *   --reset       drop and recreate all expert state (DANGEROUS — dev only)
 */
import { PrismaClient } from "@prisma/client";
import { loadExperts, crossValidate } from "../lib/fixtures";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const doStratify = args.includes("--stratify");
  const doReset = args.includes("--reset");

  console.log("→ Validating fixtures…");
  const errors = crossValidate();
  if (errors.length > 0) {
    console.error("✗ Fixture validation failed:");
    for (const e of errors) console.error("   - " + e);
    process.exit(1);
  }
  console.log("  ok");

  if (doReset) {
    console.warn("→ --reset: wiping all expert state…");
    await prisma.rating.deleteMany();
    await prisma.reorderTop5.deleteMany();
    await prisma.evaluation.deleteMany();
    await prisma.assignment.deleteMany();
    await prisma.magicToken.deleteMany();
    await prisma.expert.deleteMany();
  }

  console.log("→ Upserting experts…");
  const experts = loadExperts();
  for (const e of experts) {
    await prisma.expert.upsert({
      where: { id: e.expertId },
      create: {
        id: e.expertId,
        email: e.email.toLowerCase(),
        fullName: e.fullName,
        sectorSpecialization: e.sectorSpecialization,
      },
      update: {
        email: e.email.toLowerCase(),
        fullName: e.fullName,
        sectorSpecialization: e.sectorSpecialization,
      },
    });
  }
  console.log(`  ok — ${experts.length} experts in DB`);

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail) {
    const existing = await prisma.expert.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.expert.create({
        data: {
          id: "admin",
          email: adminEmail,
          fullName: "Admin",
          sectorSpecialization: null,
        },
      });
      console.log(`  + admin user created for ${adminEmail}`);
    } else {
      console.log(`  admin user present (${adminEmail})`);
    }
  } else {
    console.warn("  ! ADMIN_EMAIL not set — no admin login will work");
  }

  // Demo expert — a single dedicated test account, separate from the 13 real
  // experts. Pre-assigned 3 cities covering different profiles so Carlos can
  // demo the flow without going through admin every time. Demo evaluations are
  // filtered out of metrics + export (see lib/admin-metrics.ts and the export route).
  console.log("→ Upserting demo expert…");
  await prisma.expert.upsert({
    where: { id: "demo" },
    create: {
      id: "demo",
      email: "demo@meed.local",
      fullName: "Demo Expert (sandbox)",
      sectorSpecialization: "Transversal",
    },
    update: {}, // preserve state across reseeds
  });
  const demoCities = ["city_03", "city_05", "city_10"];
  for (const cityId of demoCities) {
    await prisma.assignment.upsert({
      where: { expertId_cityId: { expertId: "demo", cityId } },
      create: { expertId: "demo", cityId },
      update: {},
    });
  }
  console.log(`  ok — demo expert assigned to ${demoCities.length} cities`);

  if (doStratify) {
    console.log("→ Running stratification…");
    const { stratify } = await import("../lib/stratification");
    const { loadCities } = await import("../lib/fixtures");
    const cities = loadCities();
    // pull preferredCityIds from DB (in case experts have already completed intake)
    const expertsWithPrefs = await prisma.expert.findMany({
      where: { id: { in: experts.map((e) => e.expertId) } },
    });
    const enriched = experts.map((e) => {
      const db = expertsWithPrefs.find((d) => d.id === e.expertId);
      return { ...e, preferredCityIds: db?.preferredCityIds ?? "" };
    });
    const assignments = stratify(enriched, cities);
    // Block reassignments for experts who already have started evaluations.
    // Every Evaluation row implies the expert opened the eval (startedAt defaults to now()),
    // so existence of the row is the "started" signal.
    const startedKeys = new Set(
      (
        await prisma.evaluation.findMany({
          select: { expertId: true, cityId: true },
        })
      ).map((e) => `${e.expertId}::${e.cityId}`)
    );
    await prisma.assignment.deleteMany({
      where: {
        AND: [
          { expertId: { in: experts.map((e) => e.expertId) } },
          {
            NOT: Array.from(startedKeys).map((k) => {
              const [expertId, cityId] = k.split("::");
              return { expertId, cityId };
            }),
          },
        ],
      },
    });
    for (const a of assignments) {
      await prisma.assignment.upsert({
        where: { expertId_cityId: { expertId: a.expertId, cityId: a.cityId } },
        create: a,
        update: {},
      });
    }
    console.log(`  ok — ${assignments.length} assignments written`);
  } else {
    console.log("→ Skipping stratification (pass --stratify to run)");
  }

  console.log("✓ Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
