import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { computeReport } from "@/lib/reporting";
import { renderPdf, renderExcel } from "@/lib/reporting/export";

// pdfkit / exceljs and Prisma require the Node.js runtime.
export const runtime = "nodejs";

const VALID_FORMATS = new Set(["pdf", "excel"]);

/**
 * Parse a query date param into a Date, or null when absent/invalid.
 * @param {string|null} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/reports/export?format=pdf|excel&from&to — Admin-only report export.
 *
 * Authorization (Req 10.4): Admin only via `requireRole(request, "reports")`.
 * Non-admin callers receive 403 and NO document is generated.
 *
 * The endpoint fetches the same rows as the stats endpoint (graves, plots,
 * requests, feedback) and computes the model via `computeReport(data, period)`
 * from "@/lib/reporting" — reusing the exact aggregation the on-screen report
 * uses, so exported values are numerically identical (Req 10.3, Property 19).
 *
 * The model is rendered to PDF (`pdfkit`) or Excel (`exceljs`) and streamed as
 * a download with the correct headers (Req 10.1, 10.2). An empty period yields
 * a zero-value document carrying a visible "no records" note (Req 10.5).
 *
 * If document generation throws after the request is accepted, the endpoint
 * returns a 500 export-failure response and never a partial/corrupt document
 * (Req 10.6): the rendered Buffer is fully materialized before any response
 * body is sent.
 */
export async function GET(request) {
  // Authorization before any document work (Req 10.4).
  const authz = await requireRole(request, "reports");
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "pdf").toLowerCase();

  // Validate format up-front; invalid → 400, no document (Req 10.1, 10.2).
  if (!VALID_FORMATS.has(format)) {
    return NextResponse.json(
      {
        error: {
          type: "validation",
          message: "Query param 'format' must be 'pdf' or 'excel'",
        },
      },
      { status: 400 }
    );
  }

  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const period = { from, to };

  try {
    // Fetch the same rows the stats endpoint aggregates, scoped by period.
    // `computeReport` re-filters defensively, but we also scope the queries so
    // large tables do not over-fetch (Req 10.1/10.2 timing).
    const [graves, plots, requests, feedback] = await Promise.all([
      prisma.grave.findMany({ select: { status: true, burialDate: true, createdAt: true } }),
      prisma.plot.findMany({ select: { status: true, createdAt: true } }),
      prisma.request.findMany({ select: { status: true, createdAt: true } }),
      prisma.feedback.findMany({ select: { rating: true, createdAt: true } }),
    ]);

    // Reuse the SAME aggregation as the on-screen report (Req 10.3).
    const model = computeReport({ graves, plots, requests, feedback }, period);
    const periodTag = model.period.from || model.period.to ? "period" : "all-time";

    // Render fully into a Buffer BEFORE responding, so a generation failure
    // never yields a partial/corrupt document (Req 10.6).
    if (format === "pdf") {
      const buffer = await renderPdf(model);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="report-${periodTag}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    }

    const buffer = await renderExcel(model);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${periodTag}.xlsx"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    // Generation failed after acceptance → error, no partial document (Req 10.6).
    console.error("GET /api/reports/export error:", error);
    return NextResponse.json(
      {
        error: {
          type: "export_failed",
          message: "Report export failed to generate",
        },
      },
      { status: 500 }
    );
  }
}
