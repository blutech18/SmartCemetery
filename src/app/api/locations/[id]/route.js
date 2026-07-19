import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";
import { getClientIp, writeAuditLog } from "@/lib/audit";

const UPDATE_LOCATION_SCHEMA = {
  name: { type: "string", trim: true, min: 1, max: 100 },
  description: { type: "string", trim: true, max: 5000 },
  gpsLat: { type: "number", min: -90, max: 90 },
  gpsLng: { type: "number", min: -180, max: 180 },
  isActive: { type: "boolean" },
};

const ALLOWED_FIELDS = Object.keys(UPDATE_LOCATION_SCHEMA);

function idError() {
  return validationErrorResponse([
    { field: "id", code: "type", message: "id must be a positive integer" },
  ]);
}

export async function PATCH(request, { params }) {
  const auth = await requireRole(request, "layout");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const locationId = Number(id);
  if (!Number.isInteger(locationId) || locationId <= 0) return idError();

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supplied = ALLOWED_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  if (supplied.length === 0) {
    return validationErrorResponse([
      { field: "body", code: "required", message: "At least one location field is required" },
    ]);
  }
  const validationSource = { ...body };
  for (const field of ["description", "gpsLat", "gpsLng"]) {
    if (validationSource[field] === null) delete validationSource[field];
  }
  const validation = validateBody(validationSource, UPDATE_LOCATION_SCHEMA);
  const extraErrors = [];
  if (Object.prototype.hasOwnProperty.call(body, "name") && !body.name?.trim?.()) {
    extraErrors.push({ field: "name", code: "required", message: "name is required" });
  }
  if (body.isActive === null) {
    extraErrors.push({ field: "isActive", code: "type", message: "isActive must be of type boolean" });
  }
  if (!validation.valid || extraErrors.length) {
    return validationErrorResponse([
      ...(validation.valid ? [] : validation.errors),
      ...extraErrors,
    ]);
  }

  const data = {};
  for (const field of supplied) {
    if (["description", "gpsLat", "gpsLng"].includes(field) && body[field] === null) {
      data[field] = null;
    } else if (Object.prototype.hasOwnProperty.call(validation.value, field)) {
      data[field] = validation.value[field];
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "isActive")) {
    if (data.isActive) {
      data.deactivatedAt = null;
      data.deactivatedById = null;
    } else {
      data.deactivatedAt = new Date();
      data.deactivatedById = Number(auth.user.id);
    }
  }

  try {
    const location = await prisma.location.update({
      where: { id: locationId },
      data,
      include: {
        details: {
          include: {
            plots: { select: { id: true, plotNumber: true, status: true } },
          },
        },
      },
    });

    const lifecycleChanged = Object.prototype.hasOwnProperty.call(data, "isActive");
    await writeAuditLog({
      userId: auth.user.id,
      action: lifecycleChanged
        ? data.isActive ? "location.reactivate" : "location.deactivate"
        : "location.update",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(location);
  } catch (error) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    console.error("PATCH /api/locations/[id] error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}