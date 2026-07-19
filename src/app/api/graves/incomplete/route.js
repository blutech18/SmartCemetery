import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateRecordCompleteness } from "@/lib/validation";

/**
 * GET /api/graves/incomplete — Incomplete-record alert list (Req 5).
 *
 * Authorized for Admin or Staff (the "verify" resource). Returns every active
 * grave record missing at least one critical field (deceasedName, burialDate,
 * plotId, plotGps), each annotated with the explicit list of missing field names
 * (Req 5.2, 5.3). Records with all three fields present are excluded (Req 5.4).
 * When none are incomplete, returns an empty list with an indication that no
 * incomplete records exist (Req 5.5). On a data-source failure, returns a 500
 * error and never a partial/stale list (Req 5.6).
 */
export async function GET(request) {
  // Authorization before reading (Admin or Staff).
  const authz = await requireRole(request, "verify");
  if (!authz.ok) return authz.response;

  try {
    const graves = await prisma.grave.findMany({
      where: { status: "active" },
      select: {
        id: true,
        deceasedName: true,
        burialDate: true,
        plotId: true,
        verificationStatus: true,
        plot: { select: { plotNumber: true, gpsLat: true, gpsLng: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const records = [];
    for (const grave of graves) {
      const plotGps = grave.plot
        ? { lat: grave.plot.gpsLat, lng: grave.plot.gpsLng }
        : null;
      const { isComplete, missing } = validateRecordCompleteness({ ...grave, plotGps });
      if (!isComplete) {
        records.push({
          id: grave.id,
          missing,
          deceasedName: grave.deceasedName,
          burialDate: grave.burialDate,
          plotId: grave.plotId,
          plotNumber: grave.plot?.plotNumber ?? null,
          plotGps,
          verificationStatus: grave.verificationStatus,
        });
      }
    }

    if (records.length === 0) {
      // No incomplete records (Req 5.5).
      return NextResponse.json({
        records: [],
        count: 0,
        message: "No incomplete records",
      });
    }

    return NextResponse.json({ records, count: records.length });
  } catch (error) {
    // Data-source failure — return an error, never a partial/stale list (Req 5.6).
    console.error("GET /api/graves/incomplete error:", error);
    return NextResponse.json(
      {
        error: {
          type: "data_source",
          message: "Failed to retrieve incomplete-record alert list",
        },
      },
      { status: 500 }
    );
  }
}
