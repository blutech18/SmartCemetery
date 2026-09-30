import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * AppSetting key holding the cemetery boundary polygon vertex offsets. The
 * name is historical; it is kept so boundaries saved earlier remain valid.
 */
const BOUNDARY_KEY = "cmp_boundary_offsets";
const MIN_OFFSETS = 3;
const MAX_OFFSETS = 200;
const COORD_LIMIT_METERS = 1000;

/**
 * Validate boundary offsets: an array of 3–200 `{ dx, dy }` finite numbers
 * within ±1000 m. Returns the normalized array, or null when invalid.
 */
export function validateBoundaryOffsets(value) {
  if (!Array.isArray(value) || value.length < MIN_OFFSETS || value.length > MAX_OFFSETS) {
    return null;
  }
  const parsed = [];
  for (const point of value) {
    const dx = Number(point?.dx);
    const dy = Number(point?.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    if (Math.abs(dx) > COORD_LIMIT_METERS || Math.abs(dy) > COORD_LIMIT_METERS) return null;
    parsed.push({ dx: Number(dx.toFixed(2)), dy: Number(dy.toFixed(2)) });
  }
  return parsed;
}

// GET /api/settings/boundary — shared boundary polygon for the map (any role).
export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: BOUNDARY_KEY } });
    let offsets = null;
    if (setting?.value) {
      try {
        offsets = validateBoundaryOffsets(JSON.parse(setting.value));
      } catch {
        offsets = null;
      }
    }
    return NextResponse.json({ offsets });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/settings/boundary — Admin-only layout change.
export async function PUT(request) {
  const auth = await requireRole(request, "layout");
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const offsets = validateBoundaryOffsets(body?.offsets);
  if (!offsets) {
    return NextResponse.json(
      {
        error: {
          type: "validation",
          message: `offsets must be an array of ${MIN_OFFSETS}-${MAX_OFFSETS} {dx, dy} numbers within ±${COORD_LIMIT_METERS} m`,
        },
      },
      { status: 400 }
    );
  }

  try {
    const value = JSON.stringify(offsets);
    await prisma.appSetting.upsert({
      where: { key: BOUNDARY_KEY },
      create: { key: BOUNDARY_KEY, value },
      update: { value },
    });
    await writeAuditLog({
      userId: auth.user.id,
      action: "boundary.update",
      ipAddress: getClientIp(request),
      details: { vertices: offsets.length },
    });
    return NextResponse.json({ offsets });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/settings/boundary — Admin-only reset: remove the saved boundary so
// clients fall back to the default derived from the building plots.
export async function DELETE(request) {
  const auth = await requireRole(request, "layout");
  if (!auth.ok) return auth.response;

  try {
    await prisma.appSetting.deleteMany({ where: { key: BOUNDARY_KEY } });
    await writeAuditLog({
      userId: auth.user.id,
      action: "boundary.reset",
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ offsets: null });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
