import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ route: "/" });
  if (session.user.isAdmin) return NextResponse.json({ route: "/admin" });
  const expert = await prisma.expert.findUnique({
    where: { id: session.user.id },
  });
  if (!expert) return NextResponse.json({ route: "/" });
  if (!expert.consentedAt) return NextResponse.json({ route: "/onboarding" });
  return NextResponse.json({ route: "/dashboard" });
}
