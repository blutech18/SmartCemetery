/**
 * Property-based tests for the Reporting phase.
 *
 * Covers spec tasks 15.2 and 16.2 of the "complete-smart-cemetery-platform"
 * spec, exercising the pure aggregation in `compute.js` and the document
 * rendering in `export.js`.
 *
 * Design properties:
 *  - Property 20 (task 15.2): report breakdown counts partition the totals with
 *    all buckets present.
 *  - Property 19 (task 16.2): exported report values equal on-screen report
 *    values.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import ExcelJS from "exceljs";
import {
  computeReport,
  REQUEST_STATUSES,
  RATING_BUCKETS,
  PLOT_STATUSES,
} from "@/lib/reporting/compute.js";
import { renderExcel } from "@/lib/reporting/export.js";

// ── Shared generators ──────────────────────────────────────────

/** A date within a bounded window, as an ISO string. */
const isoDate = fc
  .date({
    min: new Date("2020-01-01T00:00:00.000Z"),
    max: new Date("2025-01-01T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

/** A grave row with a recognized status and a burial/created timestamp. */
const graveRow = fc.record({
  status: fc.constantFrom("active", "archived"),
  burialDate: isoDate,
  createdAt: isoDate,
});

/** A plot row with a recognized status. */
const plotRow = fc.record({
  status: fc.constantFrom(...PLOT_STATUSES),
  createdAt: isoDate,
});

/** A request row whose status is drawn from the recognized set. */
const recognizedRequestRow = fc.record({
  status: fc.constantFrom(...REQUEST_STATUSES),
  createdAt: isoDate,
});

/** A feedback row whose rating is within the recognized 1–5 range. */
const inRangeFeedbackRow = fc.record({
  rating: fc.constantFrom(...RATING_BUCKETS),
  createdAt: isoDate,
});

/**
 * An optional period. When present it deliberately spans the full generator
 * window so no rows are filtered out — the partition/identity invariants must
 * hold whether or not a period is supplied.
 */
const spanningPeriod = fc.option(
  fc.constant({
    from: "2019-01-01T00:00:00.000Z",
    to: "2026-01-01T00:00:00.000Z",
  }),
  { nil: null }
);

/** A dataset made entirely of recognized/in-range rows. */
const recognizedDataset = fc.record({
  graves: fc.array(graveRow, { maxLength: 40 }),
  plots: fc.array(plotRow, { maxLength: 40 }),
  requests: fc.array(recognizedRequestRow, { maxLength: 60 }),
  feedback: fc.array(inRangeFeedbackRow, { maxLength: 60 }),
});

// ── Property 20 (task 15.2) ────────────────────────────────────
// Report breakdown counts partition the totals with all buckets present.
// Validates: Requirements 11.1, 11.2, 11.3, 11.4
describe("Property 20: report breakdown counts partition totals with all buckets present", () => {
  const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

  it("emits all request statuses & rating buckets; recognized/in-range sums equal the totals (with or without a period)", () => {
    fc.assert(
      fc.property(recognizedDataset, spanningPeriod, (data, period) => {
        const report = computeReport(data, period);

        // Request breakdown exposes exactly pending/approved/rejected.
        expect(Object.keys(report.requests.byStatus).sort()).toEqual(
          [...REQUEST_STATUSES].sort()
        );

        // Feedback distribution has a count for every bucket 1–5 (zeros incl.).
        for (const bucket of RATING_BUCKETS) {
          expect(report.feedback.distribution).toHaveProperty(String(bucket));
          expect(typeof report.feedback.distribution[bucket]).toBe("number");
        }

        // All inputs are recognized/in-range, so the breakdowns partition the
        // totals exactly.
        expect(sum(report.requests.byStatus)).toBe(report.requests.total);
        expect(sum(report.feedback.distribution)).toBe(report.feedback.total);
      }),
      { numRuns: 200 }
    );
  });

  it("counts only recognized statuses / in-range ratings when unrecognized rows are mixed in", () => {
    const messyRequestRow = fc.record({
      status: fc.oneof(
        fc.constantFrom(...REQUEST_STATUSES),
        fc.constantFrom("cancelled", "unknown", "", "PENDING")
      ),
      createdAt: isoDate,
    });
    const messyFeedbackRow = fc.record({
      rating: fc.oneof(
        fc.constantFrom(...RATING_BUCKETS),
        fc.constantFrom(0, 6, -1, 10, 3.5)
      ),
      createdAt: isoDate,
    });

    fc.assert(
      fc.property(
        fc.array(messyRequestRow, { maxLength: 80 }),
        fc.array(messyFeedbackRow, { maxLength: 80 }),
        (requests, feedback) => {
          // No period: every provided row is in-period, so we can count the
          // recognized/in-range inputs directly.
          const report = computeReport({ requests, feedback }, null);

          const recognizedRequests = requests.filter((r) =>
            REQUEST_STATUSES.includes(r.status)
          ).length;
          const inRangeFeedback = feedback.filter((f) =>
            RATING_BUCKETS.includes(f.rating)
          ).length;

          // All buckets/keys still present.
          expect(Object.keys(report.requests.byStatus).sort()).toEqual(
            [...REQUEST_STATUSES].sort()
          );
          for (const bucket of RATING_BUCKETS) {
            expect(report.feedback.distribution).toHaveProperty(String(bucket));
          }

          // The recognized-only sum equals the count of recognized rows, and is
          // never larger than the reported total.
          expect(sum(report.requests.byStatus)).toBe(recognizedRequests);
          expect(sum(report.requests.byStatus)).toBeLessThanOrEqual(
            report.requests.total
          );
          expect(sum(report.feedback.distribution)).toBe(inRangeFeedback);
          expect(sum(report.feedback.distribution)).toBeLessThanOrEqual(
            report.feedback.total
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it("empty dataset yields every group present with zero counts and no error", () => {
    const report = computeReport({}, null);

    expect(report.requests.total).toBe(0);
    expect(Object.keys(report.requests.byStatus).sort()).toEqual(
      [...REQUEST_STATUSES].sort()
    );
    for (const status of REQUEST_STATUSES) {
      expect(report.requests.byStatus[status]).toBe(0);
    }

    expect(report.feedback.total).toBe(0);
    for (const bucket of RATING_BUCKETS) {
      expect(report.feedback.distribution[bucket]).toBe(0);
    }
    expect(report.graves.total).toBe(0);
    expect(report.plots.total).toBe(0);
  });
});

// ── Property 19 (task 16.2) ────────────────────────────────────
// Exported report values equal on-screen report values.
// Validates: Requirements 10.3
//
// PDFs/xlsx are binary and `buildSections` is not exported by export.js, so we
// verify identity at the values level: render the model to a real .xlsx buffer,
// read every numeric cell back with exceljs, and confirm each figure matches
// the on-screen model from computeReport. Runs are kept modest (30) because a
// full workbook round-trip per run is comparatively expensive; the pure
// partition property above carries the high run count.
describe("Property 19: exported report values equal on-screen report values", () => {
  /** Expected [section, metric] -> value map, mirroring export.js buildSections. */
  const expectedFigures = (model) => {
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const entries = {
      "Graves||Total": model.graves.total,
      "Graves||Active": model.graves.active,
      "Graves||Archived": model.graves.archived,
      "Plots||Total": model.plots.total,
      "Plots||Occupancy rate (%)": model.plots.occupancyRate,
      "Requests||Total": model.requests.total,
      "Feedback||Total": model.feedback.total,
      "Feedback||Average rating": model.feedback.averageRating,
    };
    for (const status of PLOT_STATUSES) {
      entries[`Plots||${cap(status)}`] = model.plots[status];
    }
    for (const status of REQUEST_STATUSES) {
      entries[`Requests||${cap(status)}`] = model.requests.byStatus[status];
    }
    for (const bucket of RATING_BUCKETS) {
      entries[`Feedback||Rating ${bucket}`] = model.feedback.distribution[bucket];
    }
    return entries;
  };

  /** Read numeric [section||metric] -> value pairs back from an .xlsx buffer. */
  const readbackFigures = async (buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.getWorksheet("Report");
    const found = {};
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header row
      const section = row.getCell(1).value;
      const metric = row.getCell(2).value;
      const value = row.getCell(3).value;
      if (typeof section === "string" && typeof metric === "string" && typeof value === "number") {
        found[`${section}||${metric}`] = value;
      }
    });
    return found;
  };

  it("every statistic in the exported Excel document matches the on-screen model", async () => {
    await fc.assert(
      fc.asyncProperty(recognizedDataset, spanningPeriod, async (data, period) => {
        const model = computeReport(data, period);
        const buffer = await renderExcel(model);
        const readback = await readbackFigures(buffer);
        const expected = expectedFigures(model);

        for (const [key, value] of Object.entries(expected)) {
          expect(readback[key]).toBe(value);
        }
      }),
      { numRuns: 30 }
    );
  });
});
