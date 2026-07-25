import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { evaluateRouteAccess } from "@/lib/route-access";

/**
 * Optimistic route guard (Next.js 16 `proxy` convention — the renamed
 * `middleware`). This is a fast first line of defense only: it redirects
 * unauthenticated access to `/dashboard/*` pages to `/login`. Authoritative
 * authorization (role checks, JWT validation) is enforced inside each route
 * handler — see the two-layer security model in the design doc.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4 (1.5 is handled on the login page).
 */
export default async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Read the verified JWT (decoded/validated by NextAuth). Missing, expired,
  // or malformed tokens surface as `null` or an unusable token, which
  // `evaluateRouteAccess` treats as unauthenticated.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const decision = evaluateRouteAccess({ pathname, token, now: Date.now() });

  if (decision.action === "redirect") {
    const loginUrl = new URL(decision.to, request.url);
    loginUrl.searchParams.set("callbackUrl", decision.callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated, but the role may not view this page. Send them to their own
  // dashboard home instead of rendering a page whose actions would all 403.
  if (decision.action === "denied") {
    const homeUrl = new URL(decision.to, request.url);
    homeUrl.searchParams.set("denied", "1");
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
