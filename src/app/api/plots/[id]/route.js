import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";
import { getClientIp, writeAuditLog } from "@/lib/audit";

const PLOT_STATUSES = ["available", "occupied", "reserved", "maintenance"];

// Validation schema for plot updates — all fields optional (partial update) (Req 15).
const UPDATE_PLOT_SCHEMA = {
  locationDetailId: { type: "integer" },
  plotNumber: { type: "string", trim: true, max: 30 },
  status: { type: "string", enum: PLOT_STATUSES },
  gpsLat: { type: "number", min: -90, max: 90 },
  gpsLng: { type: "number", min: -180, max: 180 },
};

export async function PUT(request, { params }) {
  try {
    // Authorization before any mutation (Req 2.4).
    const authz = await requireRole(request, "layout");
    if (!authz.ok) return authz.response;
    const { user } = authz;

    // Next.js 16: dynamic route `params` is async and must be awaited.
    const { id } = await params;
    const body = await request.json();

    // Uniform validation (Req 15.2, 15.4).
    const validation = validateBody(body, UPDATE_PLOT_SCHEMA);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors);
    }
    const { locationDetailId, plotNumber, status, gpsLat, gpsLng } = validation.value;

    const plot = await prisma.plot.update({
      where: { id: parseInt(id) },
      data: {
        locationDetailId,
        plotNumber,
        status,
        gpsLat,
        gpsLng,
      },
    });

    // Audit after the mutation is committed (Req 14.1).
    await writeAuditLog({
      userId: user.id,
      action: "plot.update",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(plot);
  } catch (error) {
    console.error("PUT /api/plots/[id] error:", error);
    return NextResponse.json({ error: "Failed to update plot" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authz = await requireRole(request, "layout");
    if (!authz.ok) return authz.response;
    const { user } = authz;

    const { id } = await params;
    const plotId = Number(id);
    if (!Number.isInteger(plotId) || plotId <= 0) {
      return validationErrorResponse([
        { field: "id", code: "type", message: "id must be a positive integer" },
      ]);
    }

    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      include: { graves: { select: { id: true, status: true } } },
    });
    if (!plot) {
      return NextResponse.json({ error: "Plot not found" }, { status: 404 });
    }

    if (plot.graves.length > 0) {
      const hasArchived = plot.graves.some((grave) => grave.status === "archived");
      return NextResponse.json(
        {
          error: hasArchived
            ? "This plot contains an archived grave and can never be deleted"
            : "This plot contains a grave record and cannot be deleted",
        },
        { status: 409 }
      );
    }

    await prisma.plot.delete({ where: { id: plotId } });
    await writeAuditLog({
      userId: user.id,
      action: "plot.delete",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        { error: "Plot is still referenced and cannot be deleted" },
        { status: 409 }
      );
    }
    console.error("DELETE /api/plots/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete plot" }, { status: 500 });
  }
}
