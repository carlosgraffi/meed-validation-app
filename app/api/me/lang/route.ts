import { NextResponse } from "next/server";
import { z } from "zod";
import { LANG_COOKIE } from "@/lib/i18n";

const Body = z.object({ lang: z.enum(["es", "en"]) });

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  const parsed = Body.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_lang" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LANG_COOKIE, parsed.data.lang, {
    httpOnly: false, // client can read for prefetch hint if needed
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
  return res;
}
