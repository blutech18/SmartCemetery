import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { parsePhotoRequest } from "@/lib/photo-upload";
import { setPlotPhoto } from "@/lib/plot-photos";

export const runtime = "nodejs";

// POST /api/graves/:id/photo — set/clear the photo of a grave's tier (or, with
// applyToAll, the whole plot).
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  // Only Admin and Staff may edit grave photos
  if (auth.user.role !== "Admin" && auth.user.role !== "Staff") {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const graveId = Number(id);
  if (!Number.isInteger(graveId) || graveId <= 0) {
    return NextResponse.json({ error: "Invalid grave ID" }, { status: 400 });
  }

  const grave = await prisma.grave.findUnique({
    where: { id: graveId },
    select: { id: true, plotId: true, tier: true, plot: { select: { totalTiers: true } } },
  });
  if (!grave) {
    return NextResponse.json({ error: "Grave record not found" }, { status: 404 });
  }

  const change = await parsePhotoRequest(request, `grave-${graveId}`);
  if (!change.ok) {
    return NextResponse.json({ error: change.error }, { status: change.status });
  }

  const tier = change.tier ?? grave.tier;
  const photos = await setPlotPhoto({
    plotId: grave.plotId,
    tier,
    photoUrl: change.photoUrl,
    applyToAll: change.applyToAll,
    totalTiers: Math.max(grave.plot?.totalTiers ?? 1, grave.tier),
  });

  await writeAuditLog({
    userId: auth.user.id,
    action: "grave.photo_update",
    resourceId: String(grave.id),
    ipAddress: getClientIp(request),
    details: { photoUrl: change.photoUrl, tier, applyToAll: change.applyToAll },
  });

  return NextResponse.json({
    ok: true,
    photoUrl: change.photoUrl,
    tier,
    plotId: grave.plotId,
    photos,
    message: change.photoUrl ? "Photo updated successfully" : "Photo reset to default",
  });
}
