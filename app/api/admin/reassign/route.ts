import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";

const Body = z.object({
  fromExpertId: z.string(),
  toExpertId: z.string(),
  cityId: z.string(),
});

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { fromExpertId, toExpertId, cityId } = parsed.data;
  if (fromExpertId === toExpertId) {
    return NextResponse.json({ error: "from and to must differ" }, { status: 400 });
  }

  // Source assignment exists?
  const fromAssignment = await prisma.assignment.findUnique({
    where: { expertId_cityId: { expertId: fromExpertId, cityId } },
  });
  if (!fromAssignment) {
    return NextResponse.json({ error: "fromExpert is not assigned to this city" }, { status: 404 });
  }

  // Block reassignment if the source evaluation has been STARTED.
  const fromEval = await prisma.evaluation.findUnique({
    where: { expertId_cityId: { expertId: fromExpertId, cityId } },
  });
  if (fromEval) {
    return NextResponse.json(
      { error: "source expert has already started this evaluation — cannot reassign" },
      { status: 409 }
    );
  }

  // Block if target expert already has this city.
  const targetExisting = await prisma.assignment.findUnique({
    where: { expertId_cityId: { expertId: toExpertId, cityId } },
  });
  if (targetExisting) {
    return NextResponse.json(
      { error: "target expert is already assigned to this city" },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.assignment.delete({ where: { id: fromAssignment.id } }),
    prisma.assignment.create({ data: { expertId: toExpertId, cityId } }),
  ]);

  return NextResponse.json({ ok: true });
}
