import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";
import { loadActions, loadCities, loadExperts, loadModelOutputs } from "@/lib/fixtures";
import { computeLiveMetrics } from "@/lib/admin-metrics";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cities = loadCities();
  const actions = loadActions();
  const modelOutputs = loadModelOutputs();
  const expertsFixture = loadExperts();

  // Note: omit admin user from the export. The fixture list is the source of truth for who the experts are.
  const experts = await prisma.expert.findMany({
    where: { id: { in: expertsFixture.map((e) => e.expertId) } },
  });

  const evaluations = await prisma.evaluation.findMany({
    include: { ratings: true, reorderTop5: true },
    where: { expertId: { in: expertsFixture.map((e) => e.expertId) } },
  });

  const evalRows = evaluations.map((e) => ({
    expertId: e.expertId,
    cityId: e.cityId,
    startedAt: e.startedAt.toISOString(),
    submittedAt: e.submittedAt?.toISOString() ?? null,
    timeOnTaskSec: e.timeOnTaskSec,
    currentStage: e.currentStage,
    ratings: e.ratings.map((r) => ({
      actionId: r.actionId,
      modelRank: r.modelRank,
      question: r.question, // 'top3' (Stage 1) or 'top10' (Stage 2) — symmetric questioning preserved
      likert: r.likert,
      notSure: r.notSure,
    })),
    reorderTop5: e.reorderTop5 ? (JSON.parse(e.reorderTop5.orderedActionIds) as string[]) : null,
    missingActions: e.missingActions ? (JSON.parse(e.missingActions) as string[]) : [],
    cityComment: e.cityComment ?? null,
  }));

  const computedMetrics = await computeLiveMetrics();

  const payload = {
    exportedAt: new Date().toISOString(),
    experts: experts.map((e) => ({
      expertId: e.id,
      email: e.email,
      fullName: e.fullName,
      sectorSpecialization: e.sectorSpecialization,
      preferredCityIds: e.preferredCityIds ? e.preferredCityIds.split(",").filter(Boolean) : [],
      consentedAt: e.consentedAt?.toISOString() ?? null,
      completedAt: e.completedAt?.toISOString() ?? null,
    })),
    cities,
    actions,
    modelOutputs,
    evaluations: evalRows,
    computedMetrics,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meed-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
