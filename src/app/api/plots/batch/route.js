import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { MAX_TIERS, sectionFromPlotNumber } from "@/lib/cemetery-layout";

// Plot statuses accepted by the layout editor. Kept in sync with
// `src/app/api/plots/[id]/route.js`.
const PLOT_STATUSES = ["available", "occupied", "reserved", "maintenance"];

// Returned to the client after a save so new plots are building-aware at once.
const SAVED_PLOT_SELECT = {
  id: true,
  plotNumber: true,
  locationDetailId: true,
  totalTiers: true,
  status: true,
  gpsLat: true,
  gpsLng: true,
  locationDetail: { select: { id: true, subsection: true } },
};

/** Tier count for a created plot: an integer 1..MAX_TIERS, default 1 (ordinary lot). */
function parseTotalTiers(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_TIERS ? n : 1;
}

export async function POST(request) {
  try {
    // Authorization before any mutation. There is deliberately no development
    // bypass here: an unauthenticated caller must never be able to mutate the
    // cemetery layout, and a bypass would attribute the change to a real Admin.
    const authz = await requireRole(request, "layout");
    if (!authz.ok) return authz.response;
    const userId = authz.user.id;

    const body = await request.json().catch(() => ({}));
    const { plots, deletePlotIds } = body;

    const hasPlots = Array.isArray(plots) && plots.length > 0;
    const rawDeleteIds = Array.isArray(deletePlotIds)
      ? deletePlotIds
          .map((id) => parseInt(id, 10))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const hasDeletions = rawDeleteIds.length > 0;

    if (!hasPlots && !hasDeletions) {
      return NextResponse.json(
        { error: "Expected an array of plots or deletePlotIds" },
        { status: 400 }
      );
    }

    // ─── 1. Separate plots with graves from empty plots for deletion ───
    let safeToDeleteIds = [];
    let graveUnpinIds = [];

    if (hasDeletions) {
      const plotsWithGraves = await prisma.plot.findMany({
        where: {
          id: { in: rawDeleteIds },
          graves: { some: {} },
        },
        select: { id: true, plotNumber: true },
      });

      const gravePlotIdsSet = new Set(plotsWithGraves.map((p) => p.id));
      safeToDeleteIds = rawDeleteIds.filter((id) => !gravePlotIdsSet.has(id));
      graveUnpinIds = Array.from(gravePlotIdsSet);
    }

    // ─── 2. Validate plot updates and additions ───
    const validUpdates = [];
    const validCreates = [];
    // New plots that could not be resolved to a section (e.g. a "custom"
    // freeform block with no locationDetailId). Surfaced to the caller instead
    // of being silently dropped.
    let skippedCreates = 0;

    if (hasPlots) {
      // Pre-fetch location details if needed to resolve locationDetailId for creations
      const needLocationLookup = plots.some(
        (p) => (!p.id || parseInt(p.id, 10) <= 0) && !p.locationDetailId && p.plotNumber
      );
      let locationDetailMap = new Map();
      if (needLocationLookup) {
        const allDetails = await prisma.locationDetail.findMany({
          select: { id: true, subsection: true },
        });
        for (const d of allDetails) {
          if (d.subsection) locationDetailMap.set(d.subsection.toUpperCase(), d.id);
        }
      }

      for (const p of plots) {
        const id = parseInt(p.id, 10);
        // Explicit coordinate unpinning: gpsLat === null and gpsLng === null
        if (p.gpsLat === null && p.gpsLng === null) {
          if (Number.isInteger(id) && id > 0) {
            validUpdates.push({ id, gpsLat: null, gpsLng: null });
          }
          continue;
        }

        const lat = Number(p.gpsLat);
        const lng = Number(p.gpsLng);
        const validCoords =
          Number.isFinite(lat) &&
          lat >= -90 &&
          lat <= 90 &&
          Number.isFinite(lng) &&
          lng >= -180 &&
          lng <= 180;

        if (!validCoords) continue;

        if (Number.isInteger(id) && id > 0) {
          validUpdates.push({ id, gpsLat: lat, gpsLng: lng });
        } else if (p.plotNumber) {
          const plotNumber = String(p.plotNumber).trim().slice(0, 30);
          // Resolve the section: explicit id, else the named building, else the
          // plot number without its column suffix (how the grid generator names it).
          let locId = parseInt(p.locationDetailId, 10);
          if (!Number.isInteger(locId) || locId <= 0) {
            const candidates = [p.buildingKey, sectionFromPlotNumber(plotNumber)];
            locId = null;
            for (const name of candidates) {
              const hit = name ? locationDetailMap.get(String(name).trim().toUpperCase()) : null;
              if (hit) {
                locId = hit;
                break;
              }
            }
          }
          if (locId && plotNumber) {
            validCreates.push({
              plotNumber,
              locationDetailId: locId,
              totalTiers: parseTotalTiers(p.totalTiers),
              status: PLOT_STATUSES.includes(p.status) ? p.status : "available",
              gpsLat: lat,
              gpsLng: lng,
            });
          } else {
            skippedCreates += 1;
          }
        }
      }
    }

    if (
      validUpdates.length === 0 &&
      validCreates.length === 0 &&
      safeToDeleteIds.length === 0 &&
      graveUnpinIds.length === 0
    ) {
      return NextResponse.json(
        { error: "No valid plot updates, additions, or deletions provided" },
        { status: 400 }
      );
    }

    // ─── 3. Build Transaction Operations ───
    const operations = [];

    // Clear foreign key references on navigations before deleting plots
    if (safeToDeleteIds.length > 0) {
      operations.push(
        prisma.navigation.updateMany({
          where: { plotId: { in: safeToDeleteIds } },
          data: { plotId: null },
        })
      );
      operations.push(
        prisma.plot.deleteMany({
          where: { id: { in: safeToDeleteIds } },
        })
      );
    }

    // Unpin plots that contain active graves but were excluded from layout
    if (graveUnpinIds.length > 0) {
      operations.push(
        prisma.plot.updateMany({
          where: { id: { in: graveUnpinIds } },
          data: { gpsLat: null, gpsLng: null },
        })
      );
    }

    // Execute updates
    for (const item of validUpdates) {
      operations.push(
        prisma.plot.update({
          where: { id: item.id },
          data: {
            gpsLat: item.gpsLat,
            gpsLng: item.gpsLng,
          },
          select: SAVED_PLOT_SELECT,
        })
      );
    }

    // Execute upserts/creations
    for (const item of validCreates) {
      operations.push(
        prisma.plot.upsert({
          where: {
            locationDetailId_plotNumber: {
              locationDetailId: item.locationDetailId,
              plotNumber: item.plotNumber,
            },
          },
          update: {
            gpsLat: item.gpsLat,
            gpsLng: item.gpsLng,
          },
          create: {
            plotNumber: item.plotNumber,
            locationDetailId: item.locationDetailId,
            totalTiers: item.totalTiers,
            status: item.status,
            gpsLat: item.gpsLat,
            gpsLng: item.gpsLng,
          },
          select: SAVED_PLOT_SELECT,
        })
      );
    }

    const txResults = await prisma.$transaction(operations);

    // Isolate returned plot objects from Prisma BatchPayload counts
    const savedPlots = txResults.filter((r) => r && typeof r === "object" && "plotNumber" in r);

    await writeAuditLog({
      userId,
      action: "plot.batch_update",
      ipAddress: getClientIp(request),
      details: {
        updatedCount: validUpdates.length,
        createdCount: validCreates.length,
        deletedCount: safeToDeleteIds.length,
        unpinnedCount: graveUnpinIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: validUpdates.length + validCreates.length,
      deletedCount: safeToDeleteIds.length,
      deletedIds: safeToDeleteIds,
      unpinnedGravePlotIds: graveUnpinIds,
      skippedCount: skippedCreates,
      plots: savedPlots,
    });
  } catch (error) {
    console.error("POST /api/plots/batch error:", error);
    return NextResponse.json(
      { error: "Failed to batch update plots" },
      { status: 500 }
    );
  }
}
