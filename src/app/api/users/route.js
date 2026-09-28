import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 100;
const EMAIL_MAX = 150;
// The seed accounts require >=12 chars; keep the API aligned with that policy.
const PASSWORD_MIN = 12;
// bcrypt only considers the first 72 bytes, so reject longer inputs instead of
// silently truncating them.
const PASSWORD_MAX_BYTES = 72;
const ROLES = ["Admin", "Staff", "Client"];
const DEFAULT_ROLE = "Client";

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Resolve the UserType for a new account from either an explicit numeric
 * `userTypeId` or a role name, validating that the type actually exists rather
 * than trusting a hardcoded id. Falls back to the Client role when neither is
 * supplied.
 */
async function resolveUserType({ userTypeId, role }) {
  const hasTypeId = userTypeId !== undefined && userTypeId !== null && userTypeId !== "";
  const hasRole = role !== undefined && role !== null && role !== "";

  if (!hasTypeId && hasRole && !ROLES.includes(role)) {
    return { error: "Invalid role" };
  }

  if (hasTypeId) {
    const parsed = Number(userTypeId);
    if (!Number.isInteger(parsed) || parsed <= 0) return { error: "Invalid role" };
    const userType = await prisma.userType.findUnique({ where: { id: parsed } });
    if (!userType) return { error: "Role is not configured" };
    return { id: userType.id };
  }

  const userType = await prisma.userType.findUnique({
    where: { typeName: hasRole ? role : DEFAULT_ROLE },
  });
  if (!userType) return { error: "Role is not configured" };
  return { id: userType.id };
}

// GET /api/users — List users (Admin only)
export async function GET(request) {
  const authz = await requireRole(request, "users");
  if (!authz.ok) return authz.response;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        userType: { select: { typeName: true } },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/users — Create new user (Admin only)
export async function POST(request) {
  const authz = await requireRole(request, "users");
  if (!authz.ok) return authz.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const { password, userTypeId, role } = body || {};

  // Uniform validation before any DB write. Errors keep the flat
  // `{ error: string }` shape the user-management UI already reads.
  if (!name) return badRequest("Name is required");
  if (name.length > NAME_MAX) {
    return badRequest(`Name must be at most ${NAME_MAX} characters`);
  }
  if (!email) return badRequest("Email is required");
  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    return badRequest("A valid email is required");
  }
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return badRequest(`Password must be at least ${PASSWORD_MIN} characters`);
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return badRequest("Password is too long");
  }

  try {
    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Resolve the role against the configured User_Type rows (no hardcoded id).
    const resolved = await resolveUserType({ userTypeId, role });
    if (resolved.error) return badRequest(resolved.error);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        userTypeId: resolved.id,
        status: "active",
      },
      include: { userType: true },
    });

    // Audit the account creation after it is persisted (best-effort).
    await writeAuditLog({
      userId: authz.user.id,
      action: "user.create",
      ipAddress: getClientIp(request),
      details: { createdUserId: user.id, role: user.userType.typeName },
    });

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, role: user.userType.typeName },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
