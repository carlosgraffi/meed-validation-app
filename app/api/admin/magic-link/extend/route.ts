import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../_guard";
import { prisma } from "@/lib/db";

/**
 * One-shot admin endpoint that extends the expiry of every expert's current
 * live magic link WITHOUT re-minting — the token strings (and the URLs the
 * experts already received) stay exactly the same, only expiresAt moves.
 *
 * Targets tokens with usedAt = null, i.e. the single live link per expert
 * (minting supersedes older ones by setting usedAt). Tokens that already
 * lapsed are revived so the same URL keeps working through the new date.
 *
 * Runs inside the Railway container because the volume-backed SQLite isn't
 * reachable from `railway run`. Idempotent: rerunning just re-sets the date.
 *
 * Default target: end of 2026-06-05 in Chile (CLT = UTC-4), i.e. 2026-06-06
 * 03:59:59Z. Pass { "until": "<ISO>" } to override.
 */
const DEFAULT_UNTIL = "2026-06-06T03:59:59.000Z";

const Body = z
  .object({ until: z.string().datetime().optional() })
  .nullable()
  .optional();

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const until = new Date(parsed.data?.until ?? DEFAULT_UNTIL);

  const live = await prisma.magicToken.findMany({
    where: { usedAt: null },
    select: { id: true, expertId: true, expiresAt: true },
  });

  await prisma.magicToken.updateMany({
    where: { usedAt: null },
    data: { expiresAt: until },
  });

  return NextResponse.json({
    ok: true,
    extended: live.length,
    expiresAt: until.toISOString(),
    experts: live.map((t) => ({ expertId: t.expertId, was: t.expiresAt.toISOString() })),
  });
}
