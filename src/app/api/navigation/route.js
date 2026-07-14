import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";

const NAVIGATION_SCHEMA = {
  origin: { type: "string", trim: true, max: 255 },
  destination: { required: true, type: "string", trim: true, min: 1, max: 255 },
};

// Authenticated users may log their own successful navigation events.
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const validation = validateBody(body, NAVIGATION_SCHEMA);
  if (!validation.valid) return validationErrorResponse(validation.errors);

  try {
    const nav = await prisma.navigation.create({
      data: {
        userId: Number(auth.user.id),
        origin: validation.value.origin ?? null,
        destination: validation.value.destination,
      },
    });
    return NextResponse.json(nav, { status: 201 });
  } catch (error) {
    console.error("POST /api/navigation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Navigation logs contain user-linked usage data and are Admin-only.
export async function GET(request) {
  const auth = await requireRole(request, "navigationLogs");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 50;

    const navigations = await prisma.navigation.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json(navigations);
  } catch (error) {
    console.error("GET /api/navigation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
