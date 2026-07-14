/**
 * Report document rendering for the Reporting & Export phase.
 *
 * This module runs ONLY in the Node.js runtime (it imports `pdfkit` and
 * `exceljs`, which are not Edge-compatible). Both renderers consume the SAME
 * report model produced by `computeReport` in "@/lib/reporting", so the values
 * written into an exported PDF or Excel file are numerically identical to the
 * on-screen report for the same period (Req 10.3, Property 19). This module
 * performs NO aggregation of its own — it only formats an already-computed
 * model.
 *
 * Both renderers surface:
 *  - grave totals (total / active / archived),
 *  - plot totals (total / available / occupied / reserved / maintenance +
 *    occupancy rate),
 *  - the request-status breakdown (pending / approved / rejected),
 *  - the feedback distribution across every 1–5 bucket (zeros included), plus
 *    total and average rating.
 *
 * When the model represents an empty period (all totals zero), a visible
 * "No records for the selected period" note is included (Req 10.5).
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */

import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { REQUEST_STATUSES, RATING_BUCKETS, PLOT_STATUSES } from "./compute.js";

/** Note shown when the selected period contains no records (Req 10.5). */
export const NO_RECORDS_NOTE = "No records for the selected period";

/**
 * Does the report model represent a period with no records at all? An empty
 * period is one where every top-level total is zero.
 * @param {object} model report model from computeReport
 * @returns {boolean}
 */
export function isEmptyPeriod(model) {
  return (
    (model?.graves?.total ?? 0) === 0 &&
    (model?.plots?.total ?? 0) === 0 &&
    (model?.requests?.total ?? 0) === 0 &&
    (model?.feedback?.total ?? 0) === 0
  );
}

/**
 * Human-readable period label, e.g. "2024-01-01 to 2024-01-31", "since …",
 * "until …", or "all time" when unbounded.
 * @param {{ from: string|null, to: string|null }} [period]
 * @returns {string}
 */
function periodLabel(period) {
  const from = period?.from ?? null;
  const to = period?.to ?? null;
  const fromDay = from ? from.slice(0, 10) : null;
  const toDay = to ? to.slice(0, 10) : null;
  if (fromDay && toDay) return `${fromDay} to ${toDay}`;
  if (fromDay) return `since ${fromDay}`;
  if (toDay) return `until ${toDay}`;
  return "all time";
}

/**
 * Flatten the report model into ordered [label, value] rows shared by both
 * renderers so the PDF and Excel outputs present the same figures in the same
 * order. Pure.
 * @param {object} model report model from computeReport
 * @returns {Array<{ section: string, rows: Array<[string, number]> }>}
 */
function buildSections(model) {
  const graves = model.graves ?? { total: 0, active: 0, archived: 0 };
  const plots = model.plots ?? {};
  const requests = model.requests ?? { total: 0, byStatus: {} };
  const feedback = model.feedback ?? { total: 0, averageRating: 0, distribution: {} };

  return [
    {
      section: "Graves",
      rows: [
        ["Total", graves.total ?? 0],
        ["Active", graves.active ?? 0],
        ["Archived", graves.archived ?? 0],
      ],
    },
    {
      section: "Plots",
      rows: [
        ["Total", plots.total ?? 0],
        ...PLOT_STATUSES.map((status) => [
          status.charAt(0).toUpperCase() + status.slice(1),
          plots[status] ?? 0,
        ]),
        ["Occupancy rate (%)", plots.occupancyRate ?? 0],
      ],
    },
    {
      section: "Requests",
      rows: [
        ["Total", requests.total ?? 0],
        ...REQUEST_STATUSES.map((status) => [
          status.charAt(0).toUpperCase() + status.slice(1),
          requests.byStatus?.[status] ?? 0,
        ]),
      ],
    },
    {
      section: "Feedback",
      rows: [
        ["Total", feedback.total ?? 0],
        ["Average rating", feedback.averageRating ?? 0],
        ...RATING_BUCKETS.map((bucket) => [
          `Rating ${bucket}`,
          feedback.distribution?.[bucket] ?? 0,
        ]),
      ],
    },
  ];
}

/**
 * Render the report model as a PDF document (Req 10.1). Collects the pdfkit
 * stream chunks into a single Buffer and resolves once the document is fully
 * written, so callers never receive a partial document. Rejects on any stream
 * error so the endpoint can convert it into an export-failure response
 * (Req 10.6).
 *
 * @param {object} reportModel model produced by computeReport
 * @returns {Promise<Buffer>}
 */
export function renderPdf(reportModel) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header.
      doc.fontSize(20).text("Smart Cemetery — Report", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .fillColor("#555")
        .text(`Period: ${periodLabel(reportModel.period)}`, { align: "center" });
      doc.fillColor("#000");
      doc.moveDown(1);

      // Empty-period note (Req 10.5).
      if (isEmptyPeriod(reportModel)) {
        doc
          .fontSize(12)
          .fillColor("#b00020")
          .text(NO_RECORDS_NOTE, { align: "center" });
        doc.fillColor("#000");
        doc.moveDown(1);
      }

      // Sections.
      for (const { section, rows } of buildSections(reportModel)) {
        doc.fontSize(14).text(section, { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        for (const [label, value] of rows) {
          doc.text(`${label}: ${value}`);
        }
        doc.moveDown(0.8);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render the report model as an Excel workbook (Req 10.2). Uses
 * `workbook.xlsx.writeBuffer()` and normalizes the result to a Node Buffer.
 * Rejects on any failure so the endpoint can convert it into an export-failure
 * response (Req 10.6).
 *
 * @param {object} reportModel model produced by computeReport
 * @returns {Promise<Buffer>}
 */
export async function renderExcel(reportModel) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Smart Cemetery";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Report");
  sheet.columns = [
    { header: "Section", key: "section", width: 20 },
    { header: "Metric", key: "metric", width: 24 },
    { header: "Value", key: "value", width: 16 },
  ];

  // Period + empty-period note (Req 10.5).
  sheet.addRow({ section: "Period", metric: periodLabel(reportModel.period), value: "" });
  if (isEmptyPeriod(reportModel)) {
    sheet.addRow({ section: "Note", metric: NO_RECORDS_NOTE, value: "" });
  }
  sheet.addRow({});

  for (const { section, rows } of buildSections(reportModel)) {
    for (const [label, value] of rows) {
      sheet.addRow({ section, metric: label, value });
    }
    sheet.addRow({});
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
