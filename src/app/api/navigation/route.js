import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";

const NAVIGATION_SCHEMA = {
  origin: { type: "string", trim: true, max: 255 },
  destination: { required: true, type: "string", trim: true, min: 1, max: 255 },
  plotId: { type: "integer", min: 1 },
  channel: { type: "string", enum: ["dashboard", "kiosk"] },
  distanceMeters: { type: "integer", min: 0, max: 1000000 },
  durationSeconds: { type: "integer", min: 0, max: 86400 },
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
        plotId: validation.value.plotId ?? null,
        channel: validation.value.channel ?? "dashboard",
        distanceMeters: validation.value.distanceMeters ?? null,
        durationSeconds: validation.value.durationSeconds ?? null,
      },
      select: { id: true },
    });
    return NextResponse.json({ success: true, id: nav.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/navigation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Raw navigation events are intentionally never exposed. Admin reporting uses
// /api/analytics, which returns period-scoped privacy-safe aggregates only.
export async function GET() {
  return NextResponse.json(
    { error: { type: "not_supported", message: "Use the aggregate analytics endpoint" } },
    { status: 405, headers: { Allow: "POST" } }
  );
}
