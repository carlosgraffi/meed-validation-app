import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";

const DEMO_CITIES = ["CL ZAL", "CL PAO", "CL RNC"];

/**
 * Reset the demo expert to a clean slate. Wipes evaluations, ratings,
 * reorders, magic tokens, and onboarding state. Reassigns the canonical
 * 3 demo cities. Same behavior as scripts/reset-demo.ts.
 */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const demo = await prisma.expert.findUnique({ where: { id: "demo" } });
  if (!demo) {
    return NextResponse.json({ error: "no_demo_expert" }, { status: 404 });
  }

  const evalCount = await prisma.evaluation.count({ where: { expertId: "demo" } });
  await prisma.evaluation.deleteMany({ where: { expertId: "demo" } });
  await prisma.magicToken.deleteMany({ where: { expertId: "demo" } });

  // CRITICAL: wipe ALL old assignments before re-adding the canonical demo
  // cities. Earlier seeds may have created assignments for cities that no
  // longer exist in cities.json (e.g. the legacy city_01..city_10 set);
  // leaving those rows in place causes /evaluate/<stale-id> to 404.
  await prisma.assignment.deleteMany({ where: { expertId: "demo" } });

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

  for (const cityId of DEMO_CITIES) {
    await prisma.assignment.create({
      data: { expertId: "demo", cityId },
    });
  }

  return NextResponse.json({
    ok: true,
    wipedEvaluations: evalCount,
    assignedCities: DEMO_CITIES,
  });
}
