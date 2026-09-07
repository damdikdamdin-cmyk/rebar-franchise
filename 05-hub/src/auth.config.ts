import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

const publicPrefixes = ["/login", "/invite", "/api/leads", "/api/auth", "/fonts/"];

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (publicPrefixes.some((p) => pathname.startsWith(p))) return true;
      return !!auth;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.partnerId = user.partnerId;
        token.storeId = user.storeId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = (token.role as Role) ?? "seller";
        session.user.partnerId = token.partnerId ?? null;
        session.user.storeId = token.storeId ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
