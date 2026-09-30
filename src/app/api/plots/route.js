import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorized, requireAuth, requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { PLOT_LIST_INCLUDE, exposePlot } from "@/lib/plot-query";
import { schemaOutOfDateResponse } from "@/lib/db-errors";

// Validation schema for plot creation (Req 15).
// `plotNumber` is optional: when omitted, the server auto-generates the next
// incremented number for the chosen section.
const CREATE_PLOT_SCHEMA = {
  locationDetailId: { required: true, type: "integer" },
  plotNumber: { type: "string", trim: true, max: 30 },
  gpsLat: { type: "number", min: -90, max: 90 },
  gpsLng: { type: "number", min: -180, max: 180 },
};

const PLOT_INCLUDE = { locationDetail: { include: { location: true } } };

// Compute the next incremented plot number for a section, e.g. "A1-013".
// Uses the section's subsection as the prefix and the highest existing trailing
// number + 1.
async function computeNextPlotNumber(locationDetailId) {
  const detail = await prisma.locationDetail.findUnique({
    where: { id: locationDetailId },
    select: { subsection: true },
  });
  const subsection = detail?.subsection || "P";
  const existing = await prisma.plot.findMany({
    where: { locationDetailId },
    select: { plotNumber: true },
  });
  let max = 0;
  for (const p of existing) {
    const m = /(\d+)\s*$/.exec(p.plotNumber || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return { subsection, next: max + 1 };
}

// Create a plot with a server-assigned, incremented plot number. Retries on the
// unique-constraint collision (concurrent inserts) by bumping the number.
async function createPlotAutoNumbered(locationDetailId, data) {
  const { subsection, next } = await computeNextPlotNumber(locationDetailId);
  let n = next;
  for (let attempt = 0; attempt < 25; attempt++) {
    const plotNumber = `${subsection}-${String(n).padStart(3, "0")}`;
    try {
      return await prisma.plot.create({
        data: { locationDetailId, plotNumber, ...data },
        include: PLOT_INCLUDE,
      });
    } catch (err) {
      if (err.code === "P2002") {
        n++; // collision — try the next number
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not allocate a unique plot number");
}

// GET /api/plots — List plots with filters
export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  // Plot/location data is needed by the map for every role, but sensitive grave
  // detail fields (cause of death, contacts, notes) are only decrypted for
  // callers holding the "verify" permission (Admin/Staff).
  const canSeeSensitive = isAuthorized(auth.user.role, "verify");

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const locationId = searchParams.get("locationId");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    // Cap page size so the full cemetery layout can be loaded by the map
    // (`/api/plots?limit=1000`) without silent truncation.
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 1000)
      : 50;

    const where = {};
    if (status) where.status = status;
    if (locationId) {
      const parsedLocationId = Number.parseInt(locationId, 10);
      if (!Number.isInteger(parsedLocationId) || parsedLocationId <= 0) {
        return NextResponse.json({ error: "Invalid locationId" }, { status: 400 });
      }
      where.locationDetail = { locationId: parsedLocationId };
    }

    const [plots, total] = await Promise.all([
      prisma.plot.findMany({
        where,
        include: PLOT_LIST_INCLUDE,
        orderBy: { plotNumber: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.plot.count({ where }),
    ]);

    const plotsWithDetails = plots.map((p) => exposePlot(p, canSeeSensitive));

    return NextResponse.json(
      {
        plots: plotsWithDetails,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    const behind = schemaOutOfDateResponse(error, "GET /api/plots");
    if (behind) return behind;
    console.error("GET /api/plots error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/plots — Create new plot
export async function POST(request) {
  try {
    // Authorization before any mutation (Req 2.4).
    const authz = await requireRole(request, "layout");
    if (!authz.ok) return authz.response;
    const { user } = authz;

    const body = await request.json();

    // Uniform validation (Req 15.1, 15.4).
    const validation = validateBody(body, CREATE_PLOT_SCHEMA);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors);
    }
    const { locationDetailId, plotNumber, gpsLat, gpsLng } = validation.value;

    const commonData = {
      status: "available",
      gpsLat: gpsLat ?? null,
      gpsLng: gpsLng ?? null,
    };

    // Auto-generate an incremented plot number when none is supplied; otherwise
    // honor the provided one (manual override).
    const plot = plotNumber
      ? await prisma.plot.create({
          data: { locationDetailId, plotNumber, ...commonData },
          include: PLOT_INCLUDE,
        })
      : await createPlotAutoNumbered(locationDetailId, commonData);

    // Audit after the mutation is committed (Req 14.1).
    await writeAuditLog({
      userId: user.id,
      action: "plot.create",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(plot, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A plot with this number already exists in this location" },
        { status: 409 }
      );
    }
    console.error("POST /api/plots error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
