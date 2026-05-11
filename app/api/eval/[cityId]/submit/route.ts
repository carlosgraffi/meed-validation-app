import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadModelOutputs } from "@/lib/fixtures";

const CLAMP_TIME_GAP_SEC = 30 * 60; // ignore single gaps longer than 30 minutes

export async function POST(_req: Request, { params }: { params: { cityId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cityId = params.cityId;
  const evaluation = await prisma.evaluation.findUnique({
    where: { expertId_cityId: { expertId: session.user.id, cityId } },
    include: { ratings: true },
  });
  if (!evaluation) {
    return NextResponse.json({ error: "not_started" }, { status: 404 });
  }
  if (evaluation.submittedAt) {
    return NextResponse.json({ ok: true });
  }

  // Validate: all 10 ranks must be rated.
  const outputs = loadModelOutputs();
  const expected = outputs[cityId]?.topActions.map((t) => t.actionId) ?? [];
  if (expected.length !== 10) {
    return NextResponse.json({ error: "no_model_output" }, { status: 500 });
  }
  const rated = new Set(evaluation.ratings.map((r) => r.actionId));
  const missing = expected.filter((id) => !rated.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Faltan ${missing.length} acciones por calificar.` },
      { status: 400 }
    );
  }

  const now = new Date();
  const totalSec = Math.max(
    0,
    Math.floor((now.getTime() - evaluation.startedAt.getTime()) / 1000)
  );
  // Heuristic clamp: if total elapsed exceeds 30 minutes, assume the expert took a break.
  // We don't have per-event timestamps to subtract precisely; cap the recorded time at 30 min
  // when the elapsed window is suspiciously long. Real per-event reconstruction can be added later.
  const timeOnTaskSec = totalSec > CLAMP_TIME_GAP_SEC ? CLAMP_TIME_GAP_SEC : totalSec;

  await prisma.evaluation.update({
    where: { id: evaluation.id },
    data: { submittedAt: now, timeOnTaskSec },
  });

  // If this was the expert's last remaining assignment, set completedAt.
  const remaining = await prisma.assignment.count({
    where: {
      expertId: session.user.id,
      cityId: { notIn: (await submittedCityIds(session.user.id)) },
    },
  });
  if (remaining === 0) {
    await prisma.expert.update({
      where: { id: session.user.id },
      data: { completedAt: now },
    });
  }

  return NextResponse.json({ ok: true });
}

async function submittedCityIds(expertId: string): Promise<string[]> {
  const rows = await prisma.evaluation.findMany({
    where: { expertId, submittedAt: { not: null } },
    select: { cityId: true },
  });
  return rows.map((r) => r.cityId);
}
