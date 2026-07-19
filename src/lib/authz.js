/**
 * Authorization guard (authoritative, server-side).
 *
 * Provides a pure role→permission matrix plus route-handler guards that verify
 * the NextAuth JWT before any mutation runs. All rejections return the uniform
 * error body defined in the design:
 *   401 -> { error: { type: "auth", message } }
 *   403 -> { error: { type: "forbidden", message } }
 *
 * `PERMISSIONS` and `isAuthorized` are pure and exported so they can be
 * property-tested without a request or database.
 */

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

/** Roles the platform recognizes. A JWT role claim outside this set -> 401. */
export const ROLES = ["Admin", "Staff", "Client"];

/**
 * Role → permission matrix (pure, property-testable).
 * A role is authorized for a resource iff it appears in the resource's list.
 */
export const PERMISSIONS = {
  users: ["Admin"],
  layout: ["Admin"], // locations, plots create/update/delete
  graves: ["Admin"], // grave record management
  reports: ["Admin"], // report generation/export
  analytics: ["Admin"],
  broadcasts: ["Admin"],
  encryption: ["Admin"],
  archival: ["Admin"],
  navigationLogs: ["Admin"],
  verify: ["Admin", "Staff"], // record verification, plot status
  request: ["Client", "Staff", "Admin"],
  feedback: ["Client", "Staff", "Admin"],
};

/**
 * Pure: does `role` satisfy the permission for `resource`?
 * Returns true iff `role` is listed under `PERMISSIONS[resource]`.
 * Unknown resources or roles yield false (deny by default).
 *
 * @param {string} role
 * @param {string} resource
 * @returns {boolean}
 */
export function isAuthorized(role, resource) {
  const allowed = PERMISSIONS[resource];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(role);
}

/** Build the uniform 401 auth-error response. */
function authErrorResponse(message = "Authentication required") {
  return NextResponse.json(
    { error: { type: "auth", message } },
    { status: 401 }
  );
}

/** Build the uniform 403 forbidden-error response. */
function forbiddenErrorResponse(message = "Insufficient role permission") {
  return NextResponse.json(
    { error: { type: "forbidden", message } },
    { status: 403 }
  );
}

/**
 * Verify the NextAuth JWT on the incoming request.
 * Returns the decoded token, or null when the token is missing/expired/
 * malformed. `getToken` transparently verifies signature and expiry.
 */
async function readToken(request) {
  try {
    return await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch {
    // A malformed token causes getToken to throw; treat as unauthenticated.
    return null;
  }
}

/** Resolve an active account and current role from the database. */
async function tokenToUser(token) {
  if (!token || token.disabled === true || !ROLES.includes(token.role)) return null;
  const id = Number(token.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  try {
    const account = await prisma.user.findUnique({
      where: { id },
      select: { status: true, userType: { select: { typeName: true } } },
    });
    const role = account?.userType?.typeName;
    if (account?.status !== "active" || !ROLES.includes(role)) return null;
    return { id, role };
  } catch {
    // Authorization fails closed when account state cannot be verified.
    return null;
  }
}

/**
 * Route-handler guard: verifies the JWT then checks the role against the
 * resource's permission list.
 *
 * @param {Request} request incoming route-handler request
 * @param {string} resource key in `PERMISSIONS`
 * @returns {Promise<{ ok: true, user: { id: any, role: string } }
 *   | { ok: false, response: NextResponse }>}
 *   - 401 when the JWT is missing/expired/malformed or its role is not one of
 *     Admin/Staff/Client.
 *   - 403 when the role is recognized but lacks permission for the resource.
 */
export async function requireRole(request, resource) {
  const token = await readToken(request);
  const user = await tokenToUser(token);

  if (!user) {
    return { ok: false, response: authErrorResponse() };
  }

  if (!isAuthorized(user.role, resource)) {
    return { ok: false, response: forbiddenErrorResponse() };
  }

  return { ok: true, user };
}

/**
 * Route-handler guard: verifies the JWT only (any recognized role passes).
 *
 * @param {Request} request incoming route-handler request
 * @returns {Promise<{ ok: true, user: { id: any, role: string } }
 *   | { ok: false, response: NextResponse }>}
 *   - 401 when the JWT is missing/expired/malformed or its role is not one of
 *     Admin/Staff/Client.
 */
export async function requireAuth(request) {
  const token = await readToken(request);
  const user = await tokenToUser(token);

  if (!user) {
    return { ok: false, response: authErrorResponse() };
  }

  return { ok: true, user };
}
