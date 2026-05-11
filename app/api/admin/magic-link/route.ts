import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "../_guard";
import { prisma } from "@/lib/db";

const Body = z.object({ expertId: z.string() });

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const expertId = parsed.data.expertId;
  const expert = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!expert) return NextResponse.json({ error: "no_such_expert" }, { status: 404 });

  // Invalidate previous active tokens for this expert
  await prisma.magicToken.updateMany({
    where: { expertId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const token = randomBytes(32).toString("base64url");
  const created = await prisma.magicToken.create({
    data: {
      token,
      expertId,
      expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
    },
  });

  return NextResponse.json({ ok: true, tokenId: created.id });
}
