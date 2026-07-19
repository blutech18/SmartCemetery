import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";
import { getClientIp, writeAuditLog } from "@/lib/audit";

const CREATE_LOCATION_SCHEMA = {
  name: { required: true, type: "string", trim: true, min: 1, max: 100 },
  description: { type: "string", trim: true, max: 5000 },
  gpsLat: { type: "number", min: -90, max: 90 },
  gpsLng: { type: "number", min: -180, max: 180 },
};

function subsectionErrors(subsections) {
  if (subsections === undefined) return [];
  if (!Array.isArray(subsections)) {
    return [{ field: "subsections", code: "type", message: "subsections must be an array" }];
  }

  const errors = [];
  subsections.forEach((entry, index) => {
    const prefix = `subsections[${index}]`;
    if (!entry || typeof entry !== "object") {
      errors.push({ field: prefix, code: "type", message: `${prefix} must be an object` });
      return;
    }
    if (typeof entry.subsection !== "string" || !entry.subsection.trim()) {
      errors.push({ field: `${prefix}.subsection`, code: "required", message: `${prefix}.subsection is required` });
    } else if (entry.subsection.trim().length > 50) {
      errors.push({ field: `${prefix}.subsection`, code: "max", message: `${prefix}.subsection must be at most 50 characters` });
    }
    if (entry.capacity !== undefined && (!Number.isInteger(entry.capacity) || entry.capacity < 0)) {
      errors.push({ field: `${prefix}.capacity`, code: "type", message: `${prefix}.capacity must be a non-negative integer` });
    }
  });
  return errors;
}

// Public-safe location layout used by map and plot views. Inactive locations
// remain hidden unless an authenticated Admin explicitly requests them.
export async function GET(request) {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  if (includeInactive) {
    const auth = await requireRole(request, "layout");
    if (!auth.ok) return auth.response;
  }

  try {
    const locations = await prisma.location.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        details: {
          include: {
            plots: { select: { id: true, plotNumber: true, status: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(locations);
  } catch (error) {
    console.error("GET /api/locations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Admin-only location creation.
export async function POST(request) {
  const auth = await requireRole(request, "layout");
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const validation = validateBody(body, CREATE_LOCATION_SCHEMA);
  const nestedErrors = subsectionErrors(body.subsections);
  if (!validation.valid || nestedErrors.length > 0) {
    return validationErrorResponse([
      ...(validation.valid ? [] : validation.errors),
      ...nestedErrors,
    ]);
  }

  const { name, description, gpsLat, gpsLng } = validation.value;
  const subsections = Array.isArray(body.subsections) ? body.subsections : [];

  try {
    const location = await prisma.location.create({
      data: {
        name,
        description: description ?? null,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        details: subsections.length
          ? {
              create: subsections.map((entry) => ({
                subsection: entry.subsection.trim(),
                capacity: entry.capacity ?? 0,
              })),
            }
          : undefined,
      },
      include: { details: true },
    });

    await writeAuditLog({
      userId: auth.user.id,
      action: "location.create",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error("POST /api/locations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
