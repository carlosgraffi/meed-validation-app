import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";

const DEMO_CITIES = ["city_03", "city_05", "city_10"];

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
    await prisma.assignment.upsert({
      where: { expertId_cityId: { expertId: "demo", cityId } },
      create: { expertId: "demo", cityId },
      update: {},
    });
  }

  return NextResponse.json({ ok: true, wipedEvaluations: evalCount });
}
