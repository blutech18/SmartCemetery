import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse, validateRecordCompleteness } from "@/lib/validation";
import { getClientIp, writeAuditLog } from "@/lib/audit";

const VERIFY_SCHEMA = {
  status: { required: true, type: "string", enum: ["verified", "rejected", "pending"] },
  note: { type: "string", trim: true, max: 500 },
};

export async function PATCH(request, { params }) {
  const auth = await requireRole(request, "verify");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const graveId = Number(id);
  if (!Number.isInteger(graveId) || graveId <= 0) {
    return validationErrorResponse([
      { field: "id", code: "type", message: "id must be a positive integer" },
    ]);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const validation = validateBody(body, VERIFY_SCHEMA);
  if (!validation.valid) return validationErrorResponse(validation.errors);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const grave = await tx.grave.findUnique({
        where: { id: graveId },
        include: {
          plot: { select: { id: true, plotNumber: true, gpsLat: true, gpsLng: true } },
        },
      });
      if (!grave) return { error: "not_found" };

      const plotGps = grave.plot
        ? { lat: grave.plot.gpsLat, lng: grave.plot.gpsLng }
        : null;
      const completeness = validateRecordCompleteness({ ...grave, plotGps });
      if (validation.value.status === "verified" && !completeness.isComplete) {
        return { error: "incomplete", missing: completeness.missing };
      }

      const updated = await tx.grave.update({
        where: { id: graveId },
        data: {
          verificationStatus: validation.value.status,
          verifiedById: Number(auth.user.id),
          verifiedAt: new Date(),
          verificationNote: validation.value.note ?? null,
        },
        include: {
          plot: { select: { id: true, plotNumber: true, gpsLat: true, gpsLng: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });
      return { updated };
    });

    if (result.error === "not_found") {
      return NextResponse.json({ error: "Grave not found" }, { status: 404 });
    }
    if (result.error === "incomplete") {
      return NextResponse.json(
        { error: "Record is incomplete and cannot be verified", missing: result.missing },
        { status: 409 }
      );
    }

    await writeAuditLog({
      userId: auth.user.id,
      action: "grave.verify",
      ipAddress: getClientIp(request),
    });
    return NextResponse.json(result.updated);
  } catch (error) {
    console.error("PATCH /api/graves/[id]/verify error:", error);
    return NextResponse.json({ error: "Failed to update verification" }, { status: 500 });
  }
}