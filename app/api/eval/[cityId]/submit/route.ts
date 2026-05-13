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

  // Validate Stage 1 + Stage 2 completion. Stage 3 reorder and Sections C/E are optional.
  const outputs = loadModelOutputs();
  const top10 = outputs[cityId]?.topActions.map((t) => t.actionId) ?? [];
  if (top10.length !== 10) {
    return NextResponse.json({ error: "no_model_output" }, { status: 500 });
  }
  const top3 = top10.slice(0, 3);
  const ratedTop3 = new Set(
    evaluation.ratings.filter((r) => r.question === "top3").map((r) => r.actionId)
  );
  const ratedTop10 = new Set(
    evaluation.ratings.filter((r) => r.question === "top10").map((r) => r.actionId)
  );
  const missingTop3 = top3.filter((id) => !ratedTop3.has(id));
  const missingTop10 = top10.filter((id) => !ratedTop10.has(id));
  if (missingTop3.length > 0) {
    return NextResponse.json(
      { error: `Faltan ${missingTop3.length} acciones en la Etapa 1.` },
      { status: 400 }
    );
  }
  if (missingTop10.length > 0) {
    return NextResponse.json(
      { error: `Faltan ${missingTop10.length} acciones en la Etapa 2.` },
      { status: 400 }
    );
  }

  const now = new Date();
  const totalSec = Math.max(
    0,
    Math.floor((now.getTime() - evaluation.startedAt.getTime()) / 1000)
  );
  const timeOnTaskSec = totalSec > CLAMP_TIME_GAP_SEC ? CLAMP_TIME_GAP_SEC : totalSec;

  await prisma.evaluation.update({
    where: { id: evaluation.id },
    data: { submittedAt: now, timeOnTaskSec, currentStage: "complete" },
  });

  const remaining = await prisma.assignment.count({
    where: {
      expertId: session.user.id,
      cityId: { notIn: await submittedCityIds(session.user.id) },
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
