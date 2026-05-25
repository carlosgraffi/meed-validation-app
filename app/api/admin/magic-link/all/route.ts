import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "../../_guard";
import { prisma } from "@/lib/db";
import { loadExperts } from "@/lib/fixtures";

/**
 * Mint a fresh magic link for every fixture expert (the panel members in
 * data/experts.json — admin and demo are excluded). Invalidates any
 * outstanding active tokens for each so only one link per expert is live.
 *
 * Returns the full list of new links in the JSON response so the admin can
 * copy them straight out without a follow-up DB round-trip. This matters
 * because Railway's SQLite volume isn't reachable from `railway run`, so
 * the JSON response is the cleanest way to ship the invitation links off
 * the production box.
 */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const fixtureExperts = loadExperts();
  const dbExperts = await prisma.expert.findMany({
    where: { id: { in: fixtureExperts.map((e) => e.expertId) } },
    orderBy: { fullName: "asc" },
  });

  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMin * 60 * 1000);

  // Derive the public base URL from the inbound request (Railway sets the
  // x-forwarded-* headers) so the links work both locally and in prod
  // without depending on NEXTAUTH_URL being set perfectly.
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const baseUrl =
    process.env.NEXTAUTH_URL ?? (host ? `${proto}://${host}` : "");

  const links: Array<{
    expertId: string;
    fullName: string;
    email: string;
    sectorSpecialization: string | null;
    url: string;
    expiresAt: string;
  }> = [];

  for (const e of dbExperts) {
    await prisma.magicToken.updateMany({
      where: { expertId: e.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    const token = randomBytes(32).toString("base64url");
    await prisma.magicToken.create({
      data: { token, expertId: e.id, expiresAt },
    });
    links.push({
      expertId: e.id,
      fullName: e.fullName,
      email: e.email,
      sectorSpecialization: e.sectorSpecialization,
      url: `${baseUrl}/auth/magic/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  }
  return NextResponse.json({
    ok: true,
    count: dbExperts.length,
    expiresAt: expiresAt.toISOString(),
    links,
  });
}
