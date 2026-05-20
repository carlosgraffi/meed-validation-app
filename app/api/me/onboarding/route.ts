import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadCities, loadExperts } from "@/lib/fixtures";
import { stratify } from "@/lib/stratification";

const Body = z.object({
  fullName: z.string().min(1).max(200),
  sectorSpecialization: z.string().nullable(),
  preferredCityIds: z.array(z.string()).max(2),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const data = await req.json().catch(() => null);
  const parsed = Body.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await prisma.expert.update({
    where: { id: session.user.id },
    data: {
      fullName: parsed.data.fullName,
      sectorSpecialization: parsed.data.sectorSpecialization,
      preferredCityIds: parsed.data.preferredCityIds.join(","),
      consentedAt: new Date(),
    },
  });

  // Always re-run stratification after onboarding so the newly-set preferences
  // are actually honored. Stratify is deterministic and idempotent for the same
  // inputs; it preserves assignments for any expert whose evaluations have
  // already started. Previously this only ran on first-time onboarding, which
  // meant preferences set on second visits were silently ignored.
  await runStratificationRespectingStartedEvals();

  return NextResponse.json({ ok: true });
}

async function runStratificationRespectingStartedEvals() {
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

  const startedKeys = new Set(
    (
      await prisma.evaluation.findMany({
        select: { expertId: true, cityId: true },
      })
    ).map((e) => `${e.expertId}::${e.cityId}`)
  );

  // Wipe assignments for experts whose evaluations haven't started yet…
  const expertsToReassign = new Set<string>();
  for (const e of fixtureExperts) {
    const started = (await prisma.evaluation.count({ where: { expertId: e.expertId } })) > 0;
    if (!started) expertsToReassign.add(e.expertId);
  }
  await prisma.assignment.deleteMany({
    where: { expertId: { in: Array.from(expertsToReassign) } },
  });

  // …then upsert the new assignments. Already-started evaluation assignments are preserved.
  for (const a of assignments) {
    if (startedKeys.has(`${a.expertId}::${a.cityId}`)) continue;
    await prisma.assignment.upsert({
      where: { expertId_cityId: { expertId: a.expertId, cityId: a.cityId } },
      create: a,
      update: {},
    });
  }
}
