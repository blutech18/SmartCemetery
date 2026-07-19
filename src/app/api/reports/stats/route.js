import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { computeReport } from "@/lib/reporting";

/**
 * GET /api/reports/stats — Dashboard statistics & report breakdowns.
 *
 * Admin-only (Req 10.4/11). Accepts optional `?from` and `?to` query params
 * defining an inclusive reporting period. Period-scoped rows are fetched and
 * fed into the shared `computeReport` model so on-screen and export values are
 * numerically identical (Req 10.3). The response includes the request-status
 * breakdown (pending/approved/rejected) and the feedback distribution (buckets
 * 1–5 incl. zeros) (Req 11.1, 11.2). An empty period yields zero-valued groups,
 * never an error (Req 11.4). Efficient parallel queries keep it within budget
 * (Req 11.5).
 *
 * Response shape (backward compatible with the existing dashboard UI):
 *   {
 *     period:   { from, to },              // NEW — echoes the requested window
 *     graves:   { total, active, archived },
 *     plots:    { total, available, occupied, reserved, maintenance, occupancyRate },
 *     locations: number,                    // preserved for the dashboard cards
 *     users:     number,                    // preserved for the dashboard cards
 *     requests: { total, pending, byStatus: { pending, approved, rejected } },
 *     feedback: { total, averageRating, totalCount, distribution: { 1..5 } }
 *   }
 * The `requests.pending` and `feedback.totalCount` fields are retained for the
 * existing dashboard/reports pages; `requests.byStatus` and
 * `feedback.distribution` are the new breakdowns added by this task.
 */
export async function GET(request) {
  const auth = await requireRole(request, "reports");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const period = { from: fromParam || null, to: toParam || null };

    // Fetch only the columns the report needs, plus the standalone counts the
    // dashboard cards depend on. All queries run in parallel (Req 11.5).
    const [graves, plots, requests, feedback, locations, users] =
      await Promise.all([
        prisma.grave.findMany({
          select: { status: true, burialDate: true, createdAt: true, verificationStatus: true },
        }),
        prisma.plot.findMany({
          select: { status: true, createdAt: true },
        }),
        prisma.request.findMany({
          select: { status: true, createdAt: true },
        }),
        prisma.feedback.findMany({
          select: { rating: true, createdAt: true },
        }),
        prisma.location.count(),
        prisma.user.count(),
      ]);

    // Reuse the shared model — do NOT recompute breakdowns inline (Req 10.3).
    const report = computeReport({ graves, plots, requests, feedback }, period);

    return NextResponse.json({
      period: report.period,
      graves: report.graves,
      plots: report.plots,
      locations,
      users,
      requests: {
        total: report.requests.total,
        // Backward-compatible flat field the dashboard reads directly.
        pending: report.requests.byStatus.pending,
        byStatus: report.requests.byStatus,
      },
      feedback: {
        total: report.feedback.total,
        averageRating: report.feedback.averageRating,
        // Backward-compatible field name used by the existing UI.
        totalCount: report.feedback.total,
        distribution: report.feedback.distribution,
      },
      // Raw grave data for client-side aggregation (burial trends, verification).
      rawGraves: graves.map((g) => ({
        burialDate: g.burialDate,
        verificationStatus: g.verificationStatus,
      })),
    });
  } catch (error) {
    console.error("GET /api/reports/stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
