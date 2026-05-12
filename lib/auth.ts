import { timingSafeEqual } from "node:crypto";
import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 }, // 2 weeks
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      id: "magic",
      name: "Magic Link",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const token = credentials?.token;
        if (!token || typeof token !== "string") return null;

        const record = await prisma.magicToken.findUnique({
          where: { token },
          include: { expert: true },
        });
        if (!record) return null;
        // `usedAt` is now a revocation flag (admin sets it when regenerating a
        // link), NOT a single-use marker. Experts can use the same link multiple
        // times until the link expires or admin regenerates.
        if (record.usedAt) return null;
        if (record.expiresAt < new Date()) return null;

        return {
          id: record.expertId,
          email: record.expert.email,
          name: record.expert.fullName,
        };
      },
    }),
    // Admin password login — permanent /admin URL gated by ADMIN_PASSWORD.
    CredentialsProvider({
      id: "admin-password",
      name: "Admin Password",
      credentials: { password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const expected = process.env.ADMIN_PASSWORD;
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
        if (!expected || !adminEmail) return null;
        const supplied = credentials?.password;
        if (!supplied || typeof supplied !== "string") return null;
        if (!constantTimeEquals(supplied, expected)) return null;

        const admin = await prisma.expert.findUnique({
          where: { email: adminEmail },
        });
        if (!admin) return null;
        return { id: admin.id, email: admin.email, name: admin.fullName };
      },
    }),
    // Demo expert login — permanent /demo URL gated by DEMO_PASSWORD. Logs in as
    // a dedicated demo expert (id "demo") whose evaluations are excluded from
    // metrics and the export so they don't pollute real validation data.
    CredentialsProvider({
      id: "demo-password",
      name: "Demo Expert Password",
      credentials: { password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const expected = process.env.DEMO_PASSWORD;
        if (!expected) return null;
        const supplied = credentials?.password;
        if (!supplied || typeof supplied !== "string") return null;
        if (!constantTimeEquals(supplied, expected)) return null;

        const demo = await prisma.expert.findUnique({ where: { id: "demo" } });
        if (!demo) return null;
        return { id: demo.id, email: demo.email, name: demo.fullName };
      },
    }),
  ],
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User | null }) {
      if (user) {
        token.expertId = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.isAdmin =
          !!user.email &&
          user.email.toLowerCase() === (process.env.ADMIN_EMAIL ?? "").toLowerCase();
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = (token.expertId as string) ?? "";
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.isAdmin = !!token.isAdmin;
      }
      return session;
    },
  },
};
