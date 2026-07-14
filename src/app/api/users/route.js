import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/authz";

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

  try {
    const body = await request.json();
    const { name, email, password, userTypeId } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Default to Client user type (id: 3)
    const typeId = userTypeId || 3;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        userTypeId: typeId,
        status: "active",
      },
      include: { userType: true },
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
