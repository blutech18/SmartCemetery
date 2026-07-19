import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { aggregateOperationsAnalytics, analyticsToCsv } from "@/lib/analytics";
import { renderAnalyticsExcel, renderAnalyticsPdf } from "@/lib/analytics-export";

export const runtime = "nodejs";

const VALID_FORMATS = new Set(["json", "csv", "pdf", "xlsx", "excel"]);

function parsePeriod(searchParams, now = new Date()) {
  const fromValue = searchParams.get("from");
  const toValue = searchParams.get("to");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((fromValue && !datePattern.test(fromValue)) || (toValue && !datePattern.test(toValue))) {
    return null;
  }

  const defaultTo = new Date(now);
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const from = new Date(`${fromValue || defaultFrom.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const to = new Date(`${toValue || defaultTo.toISOString().slice(0, 10)}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  return { from, to };
}

export async function GET(request) {
  const auth = await requireRole(request, "analytics");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams);
  if (!period) {
    return NextResponse.json(
      { error: { type: "validation", message: "Use valid YYYY-MM-DD dates with from not after to" } },
      { status: 400 }
    );
  }
  const format = (searchParams.get("format") || "json").toLowerCase();
  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json(
      { error: { type: "validation", message: "Format must be json, csv, pdf, or xlsx" } },
      { status: 400 }
    );
  }

  try {
    const createdAt = { gte: period.from, lte: period.to };
    const [logs, navigations] = await Promise.all([
      prisma.userLog.findMany({ where: { createdAt }, select: { action: true, createdAt: true } }),
      prisma.navigation.findMany({
        where: { createdAt },
        select: { createdAt: true, channel: true, plotId: true },
      }),
    ]);
    const analytics = aggregateOperationsAnalytics(logs, navigations);
    const responsePeriod = {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    };
    const periodTag = `${responsePeriod.from.slice(0, 10)}-${responsePeriod.to.slice(0, 10)}`;

    if (format === "csv") {
      const csv = analyticsToCsv(analytics, responsePeriod);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="operations-${periodTag}.csv"`,
        },
      });
    }
    if (format === "pdf") {
      const buffer = await renderAnalyticsPdf(analytics, responsePeriod);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="operations-${periodTag}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    }
    if (format === "xlsx" || format === "excel") {
      const buffer = await renderAnalyticsExcel(analytics, responsePeriod);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="operations-${periodTag}.xlsx"`,
          "Content-Length": String(buffer.length),
        },
      });
    }

    return NextResponse.json({ period: responsePeriod, ...analytics });
  } catch {
    console.error("GET /api/analytics failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
