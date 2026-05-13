import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const Stage = z.enum(["stage1", "stage2", "sectionC", "stage3", "sectionE", "complete"]);
const Question = z.enum(["top3", "top10"]);

const RatingPatch = z.object({
  actionId: z.string(),
  modelRank: z.number().int().min(1).max(10),
  question: Question,
  likert: z.number().int().min(1).max(5),
  notSure: z.boolean(),
});

const PatchBody = z.object({
  rating: RatingPatch.optional(),
  missingActions: z.array(z.string().max(200)).max(3).optional(),
  reorderTop5: z.array(z.string()).length(5).nullable().optional(),
  cityComment: z.string().max(1000).optional(),
  advanceTo: Stage.optional(),
});

const STAGE_ORDER = ["stage1", "stage2", "sectionC", "stage3", "sectionE", "complete"] as const;

export async function PATCH(req: Request, { params }: { params: { cityId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cityId = params.cityId;
  const data = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;

  const assignment = await prisma.assignment.findUnique({
    where: { expertId_cityId: { expertId: session.user.id, cityId } },
  });
  if (!assignment) {
    return NextResponse.json({ error: "not_assigned" }, { status: 403 });
  }

  const evaluation = await prisma.evaluation.upsert({
    where: { expertId_cityId: { expertId: session.user.id, cityId } },
    create: { expertId: session.user.id, cityId },
    update: {},
  });
  if (evaluation.submittedAt) {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  // Stage read-only guard: reject rating writes for stages the user has advanced past.
  // currentStage rank: 1=stage1, 2=stage2, 3=sectionC, 4=stage3, 5=sectionE, 6=complete.
  const stageRank = (s: string) => STAGE_ORDER.indexOf(s as never) + 1;
  if (body.rating) {
    const ratingStage = body.rating.question === "top3" ? "stage1" : "stage2";
    if (stageRank(evaluation.currentStage) > stageRank(ratingStage)) {
      return NextResponse.json(
        { error: "stage_locked", stage: ratingStage },
        { status: 409 }
      );
    }
    const { actionId, modelRank, question, likert, notSure } = body.rating;
    await prisma.rating.upsert({
      where: {
        evaluationId_actionId_question: {
          evaluationId: evaluation.id,
          actionId,
          question,
        },
      },
      create: { evaluationId: evaluation.id, actionId, question, modelRank, likert, notSure },
      update: { likert, notSure, modelRank },
    });
  }

  if (body.missingActions !== undefined) {
    if (stageRank(evaluation.currentStage) > stageRank("sectionC")) {
      return NextResponse.json({ error: "stage_locked", stage: "sectionC" }, { status: 409 });
    }
    await prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { missingActions: JSON.stringify(body.missingActions) },
    });
  }
  if (body.cityComment !== undefined) {
    if (stageRank(evaluation.currentStage) > stageRank("sectionE")) {
      return NextResponse.json({ error: "stage_locked", stage: "sectionE" }, { status: 409 });
    }
    await prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { cityComment: body.cityComment },
    });
  }
  if (body.reorderTop5 !== undefined) {
    if (stageRank(evaluation.currentStage) > stageRank("stage3")) {
      return NextResponse.json({ error: "stage_locked", stage: "stage3" }, { status: 409 });
    }
    if (body.reorderTop5 === null) {
      await prisma.reorderTop5.deleteMany({ where: { evaluationId: evaluation.id } });
    } else {
      await prisma.reorderTop5.upsert({
        where: { evaluationId: evaluation.id },
        create: {
          evaluationId: evaluation.id,
          orderedActionIds: JSON.stringify(body.reorderTop5),
        },
        update: { orderedActionIds: JSON.stringify(body.reorderTop5) },
      });
    }
  }

  if (body.advanceTo) {
    // Only forward advancement is allowed; client tells us the target stage.
    if (stageRank(body.advanceTo) <= stageRank(evaluation.currentStage)) {
      return NextResponse.json({ error: "no_backward_advance" }, { status: 400 });
    }
    await prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { currentStage: body.advanceTo },
    });
  }

  return NextResponse.json({ ok: true });
}
