import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/evaluate", "/complete"];
const ADMIN_PREFIXES = ["/admin"];
// /admin/login is a public page (the login form itself) — must not be guarded.
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ADMIN_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const needsAuth =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    // Admin paths get sent to the admin login form; everyone else to landing.
    url.pathname = ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
      ? "/admin/login"
      : "/";
    return NextResponse.redirect(url);
  }

  // Admin route guard
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!token.isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  } else {
    // Expert routes: bounce admin to /admin (admin has no assignments to evaluate)
    if (token.isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/evaluate/:path*", "/complete/:path*", "/admin/:path*"],
};
