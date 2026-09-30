import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { LAYOUT_PRESET, presetTiers } from "@/lib/layout-preset";
import { applyLayoutPresetToDb } from "@/lib/layout-preset-db";
import { PLOT_LIST_INCLUDE, exposePlot } from "@/lib/plot-query";

// POST /api/plots/preset — Admin-only: apply the configured layout preset.
export async function POST(request) {
  try {
    const authz = await requireRole(request, "layout");
    if (!authz.ok) return authz.response;
    const userId = authz.user.id;

    const { location, rowCount, totalPlots } = await applyLayoutPresetToDb(
      prisma,
      LAYOUT_PRESET,
      presetTiers(LAYOUT_PRESET),
      { locationName: process.env.LAYOUT_LOCATION_NAME }
    );

    await writeAuditLog({
      userId,
      action: "plot.preset",
      resourceId: String(location.id),
      ipAddress: getClientIp(request),
      details: { presetName: LAYOUT_PRESET.name, totalPlots, activeRows: rowCount },
    });

    // Same shape as GET /api/plots (details decrypted for this Admin caller).
    const plots = await prisma.plot.findMany({
      where: { locationDetail: { locationId: location.id } },
      include: PLOT_LIST_INCLUDE,
      orderBy: [{ locationDetail: { subsection: "asc" } }, { plotNumber: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      message: `${LAYOUT_PRESET.name} layout applied and saved to the database.`,
      totalPlots,
      plots: plots.map((p) => exposePlot(p, true)),
    });
  } catch (err) {
    console.error("POST /api/plots/preset error:", err);
    return NextResponse.json(
      { error: "Failed to apply the layout preset", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
