import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";

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
        if (record.usedAt) return null;
        if (record.expiresAt < new Date()) return null;

        // Single-use: mark consumed.
        await prisma.magicToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });

        return {
          id: record.expertId,
          email: record.expert.email,
          name: record.expert.fullName,
        };
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
