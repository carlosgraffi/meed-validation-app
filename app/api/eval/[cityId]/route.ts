import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const RatingPatch = z.object({
  actionId: z.string(),
  modelRank: z.number().int().min(1).max(10),
  likert: z.number().int().min(1).max(5),
  notSure: z.boolean(),
});

const PatchBody = z.object({
  rating: RatingPatch.optional(),
  missingActions: z.array(z.string().max(200)).max(3).optional(),
  reorderTop5: z.array(z.string()).length(5).nullable().optional(),
  cityComment: z.string().max(1000).optional(),
});

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

  // Ensure an evaluation row exists.
  const evaluation = await prisma.evaluation.upsert({
    where: { expertId_cityId: { expertId: session.user.id, cityId } },
    create: { expertId: session.user.id, cityId },
    update: {},
  });
  if (evaluation.submittedAt) {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  if (body.rating) {
    const { actionId, modelRank, likert, notSure } = body.rating;
    await prisma.rating.upsert({
      where: { evaluationId_actionId: { evaluationId: evaluation.id, actionId } },
      create: { evaluationId: evaluation.id, actionId, modelRank, likert, notSure },
      update: { likert, notSure, modelRank },
    });
  }
  if (body.missingActions !== undefined) {
    await prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { missingActions: JSON.stringify(body.missingActions) },
    });
  }
  if (body.cityComment !== undefined) {
    await prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { cityComment: body.cityComment },
    });
  }
  if (body.reorderTop5 !== undefined) {
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
  return NextResponse.json({ ok: true });
}
