import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

export const runtime = "nodejs";

const ROLES = ["Admin", "Staff", "Client"];
const STATUSES = ["active", "disabled"];

/**
 * PATCH /api/users/[id] — Update a user's profile, role, status, or password.
 *
 * Admin-only (`users` permission). Safeguards:
 *  - An Admin cannot change their own role or disable their own account, which
 *    would otherwise allow locking every administrator out of the system.
 *  - The last active Admin cannot be demoted or disabled.
 *  - Email uniqueness is enforced before the write.
 */
export async function PATCH(request, { params }) {
  const authz = await requireRole(request, "users");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { name, email, role, status, password } = body || {};

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: { userType: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf = Number(authz.user.id) === userId;
    const data = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      data.name = String(name).trim();
    }

    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (!normalized || !normalized.includes("@")) {
        return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
      }
      if (normalized !== target.email) {
        const clash = await prisma.user.findUnique({ where: { email: normalized } });
        if (clash) {
          return NextResponse.json({ error: "Email already registered" }, { status: 409 });
        }
      }
      data.email = normalized;
    }

    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      if (isSelf && role !== target.userType.typeName) {
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 400 }
        );
      }
      if (target.userType.typeName === "Admin" && role !== "Admin") {
        const guard = await ensureAnotherActiveAdmin(userId);
        if (guard) return guard;
      }
      const userType = await prisma.userType.findUnique({ where: { typeName: role } });
      if (!userType) {
        return NextResponse.json({ error: "Role is not configured" }, { status: 400 });
      }
      data.userTypeId = userType.id;
    }

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (isSelf && status !== "active") {
        return NextResponse.json(
          { error: "You cannot disable your own account" },
          { status: 400 }
        );
      }
      if (status !== "active" && target.userType.typeName === "Admin") {
        const guard = await ensureAnotherActiveAdmin(userId);
        if (guard) return guard;
      }
      data.status = status;
    }

    if (password !== undefined) {
      if (String(password).length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
      data.passwordHash = await bcrypt.hash(String(password), 12);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        userType: { select: { typeName: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Block the change when `excludeId` is the only remaining active Admin. */
async function ensureAnotherActiveAdmin(excludeId) {
  const remaining = await prisma.user.count({
    where: {
      id: { not: excludeId },
      status: "active",
      userType: { typeName: "Admin" },
    },
  });
  if (remaining === 0) {
    return NextResponse.json(
      { error: "At least one active administrator must remain" },
      { status: 400 }
    );
  }
  return null;
}
