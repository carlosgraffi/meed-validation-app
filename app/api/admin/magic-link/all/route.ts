import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "../../_guard";
import { prisma } from "@/lib/db";
import { loadExperts } from "@/lib/fixtures";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const fixtureExperts = loadExperts();
  const dbExperts = await prisma.expert.findMany({
    where: { id: { in: fixtureExperts.map((e) => e.expertId) } },
  });

  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMin * 60 * 1000);

  for (const e of dbExperts) {
    // Invalidate previous
    await prisma.magicToken.updateMany({
      where: { expertId: e.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    await prisma.magicToken.create({
      data: {
        token: randomBytes(32).toString("base64url"),
        expertId: e.id,
        expiresAt,
      },
    });
  }
  return NextResponse.json({ ok: true, count: dbExperts.length });
}
