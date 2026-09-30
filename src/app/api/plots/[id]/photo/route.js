import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { parsePhotoRequest } from "@/lib/photo-upload";
import { setPlotPhoto } from "@/lib/plot-photos";

export const runtime = "nodejs";

// POST /api/plots/:id/photo — set/clear a plot (tier 0) or tier photo.
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (auth.user.role !== "Admin" && auth.user.role !== "Staff") {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const plotId = Number(id);
  if (!Number.isInteger(plotId) || plotId <= 0) {
    return NextResponse.json({ error: "Invalid plot ID" }, { status: 400 });
  }

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    select: { id: true, totalTiers: true },
  });
  if (!plot) {
    return NextResponse.json({ error: "Plot record not found" }, { status: 404 });
  }

  // Validate before any side effect so a rejected request changes nothing.
  const change = await parsePhotoRequest(request, `plot-${plotId}`);
  if (!change.ok) {
    return NextResponse.json({ error: change.error }, { status: change.status });
  }

  const tier = change.tier ?? 0;
  const photos = await setPlotPhoto({
    plotId,
    tier,
    photoUrl: change.photoUrl,
    applyToAll: change.applyToAll,
    totalTiers: plot.totalTiers,
  });

  await writeAuditLog({
    userId: auth.user.id,
    action: "plot.photo_update",
    resourceId: String(plot.id),
    ipAddress: getClientIp(request),
    details: { photoUrl: change.photoUrl, tier, applyToAll: change.applyToAll },
  });

  return NextResponse.json({
    ok: true,
    photoUrl: change.photoUrl,
    tier,
    photos,
    message: change.photoUrl ? "Photo updated successfully" : "Photo reset to default",
  });
}
