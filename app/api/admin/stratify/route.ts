import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";
import { loadCities, loadExperts } from "@/lib/fixtures";
import { stratify } from "@/lib/stratification";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cities = loadCities();
  const fixtureExperts = loadExperts();
  const dbExperts = await prisma.expert.findMany({
    where: { id: { in: fixtureExperts.map((e) => e.expertId) } },
  });
  const enriched = fixtureExperts.map((e) => {
    const db = dbExperts.find((d) => d.id === e.expertId);
    return { ...e, preferredCityIds: db?.preferredCityIds ?? "" };
  });
  const assignments = stratify(enriched, cities);

  const evals = await prisma.evaluation.findMany({
    select: { expertId: true, cityId: true },
  });
  const startedKeys = new Set(evals.map((e) => `${e.expertId}::${e.cityId}`));

  // For each expert, only allow reassigning if NONE of their evaluations have started.
  // (Mid-window safety: don't pull an in-progress evaluation out from under an expert.)
  const startedExperts = new Set(evals.map((e) => e.expertId));
  const expertsToReassign = fixtureExperts
    .map((e) => e.expertId)
    .filter((id) => !startedExperts.has(id));

  await prisma.assignment.deleteMany({
    where: { expertId: { in: expertsToReassign } },
  });

  let written = 0;
  for (const a of assignments) {
    if (startedKeys.has(`${a.expertId}::${a.cityId}`)) continue;
    if (startedExperts.has(a.expertId)) continue;
    await prisma.assignment.upsert({
      where: { expertId_cityId: { expertId: a.expertId, cityId: a.cityId } },
      create: a,
      update: {},
    });
    written++;
  }

  return NextResponse.json({
    ok: true,
    written,
    preserved: assignments.length - written,
    skippedExperts: Array.from(startedExperts),
  });
}
