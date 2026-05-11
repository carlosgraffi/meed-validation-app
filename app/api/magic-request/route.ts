import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  const parsed = Body.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const expert = await prisma.expert.findUnique({ where: { email } });

  if (!expert) {
    // Be explicit per Section 6.1: "Este correo no está registrado. Contacta a SSG."
    return NextResponse.json({ error: "unrecognized" }, { status: 404 });
  }

  const ttlMin = parseInt(process.env.MAGIC_LINK_TTL_MIN ?? "10080", 10);
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);
  const token = randomBytes(32).toString("base64url");

  await prisma.magicToken.create({
    data: {
      token,
      expertId: expert.id,
      expiresAt,
    },
  });

  // We do NOT send an email here. Carlos pulls the URL from the admin dashboard
  // and sends it manually. The expert sees a "check your email" page.
  return NextResponse.json({ ok: true });
}
