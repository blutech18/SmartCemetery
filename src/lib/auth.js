import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getClientIp } from "@/lib/audit";
import { boundedRateLimit, clearRateLimit, consumeRateLimit } from "@/lib/rate-limit";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const loginLimit = boundedRateLimit("LOGIN_RATE_LIMIT_MAX", 5, 1, 100);
        const windowSeconds = boundedRateLimit("LOGIN_RATE_LIMIT_WINDOW_SECONDS", 900, 60, 86_400);
        let throttle;
        try {
          throttle = await consumeRateLimit({
            scope: "login",
            identifier: `${getClientIp(request) || "unresolved"}:${email}`,
            limit: loginLimit,
            windowMs: windowSeconds * 1000,
          });
        } catch {
          // Authentication fails closed if the shared limiter cannot verify
          // the attempt. Do not reveal whether an account exists.
          throw new Error("Service temporarily unavailable. Please try again later.");
        }
        if (!throttle.allowed) return null;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            include: { userType: true },
          });
        } catch (error) {
          throw new Error("Database connection failed. Please try again later.");
        }

        if (!user || user.status !== "active") return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        await clearRateLimit(throttle.key).catch(() => {});

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.userType.typeName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.disabled = false;
        return token;
      }

      // Re-check account state whenever NextAuth refreshes the JWT. This makes
      // disabled/deleted users fail closed without waiting for the 8-hour JWT
      // lifetime, while a transient database outage preserves the signed token
      // rather than silently changing authorization claims.
      if (token?.id) {
        try {
          const current = await prisma.user.findUnique({
            where: { id: Number(token.id) },
            select: { status: true, userType: { select: { typeName: true } } },
          });
          if (!current || current.status !== "active") {
            token.disabled = true;
          } else {
            token.disabled = false;
            token.role = current.userType.typeName;
          }
        } catch {
          // Authoritative API guards still verify the signed token. Do not log
          // user identifiers or turn a transient auth-store outage into a leak.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.disabled = token.disabled === true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
