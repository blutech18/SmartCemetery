/**
 * Pure report computation for the Reporting & Analytics phase.
 *
 * `computeReport` is a PURE aggregation over already-fetched rows. It performs
 * NO database access — the caller fetches the rows for the selected period and
 * passes them in. This keeps the module property-testable and lets both the
 * stats endpoint (task 15.3) and the export endpoint (task 16.1) reuse the very
 * same model, guaranteeing numeric identity between on-screen and exported
 * values (Req 10.3).
 *
 * Requirements: 10.3, 11.1, 11.2, 11.3, 11.4
 */

/**
 * Mutually exclusive request statuses (Req 11.1). Order is stable so consumers
 * (screen + export) render identically.
 * @type {readonly ["pending", "approved", "rejected"]}
 */
export const REQUEST_STATUSES = Object.freeze([
  "pending",
  "approved",
  "rejected",
]);

/**
 * Every feedback rating bucket on the 1–5 scale (Req 11.2). Zero-count buckets
 * are always present in the output.
 * @type {readonly [1, 2, 3, 4, 5]}
 */
export const RATING_BUCKETS = Object.freeze([1, 2, 3, 4, 5]);

/** Plot statuses surfaced on the report. */
export const PLOT_STATUSES = Object.freeze([
  "available",
  "occupied",
  "reserved",
  "maintenance",
]);

/**
 * @typedef {Object} ReportPeriod
 * @property {Date|string|number|null} [from] inclusive lower bound
 * @property {Date|string|number|null} [to]   inclusive upper bound
 */

/**
 * @typedef {Object} ReportData
 * @property {Array<{ status?: string, burialDate?: Date|string|null, createdAt?: Date|string|null }>} [graves]
 * @property {Array<{ status?: string, createdAt?: Date|string|null }>} [plots]
 * @property {Array<{ status?: string, createdAt?: Date|string|null }>} [requests]
 * @property {Array<{ rating?: number, createdAt?: Date|string|null }>} [feedback]
 */

/**
 * Coerce a value to a millisecond timestamp, or null when it is not a usable
 * date. Pure.
 * @param {Date|string|number|null|undefined} value
 * @returns {number|null}
 */
function toMillis(value) {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Normalize a period into inclusive millisecond bounds. Returns null bounds
 * when no filtering is requested for that side. Pure.
 * @param {ReportPeriod|null|undefined} period
 * @returns {{ fromMs: number|null, toMs: number|null }}
 */
function normalizePeriod(period) {
  if (!period) return { fromMs: null, toMs: null };
  return { fromMs: toMillis(period.from), toMs: toMillis(period.to) };
}

/**
 * Is `dateValue` within the (optional) inclusive period bounds? Rows whose date
 * field is absent are treated as in-period only when no bounds are set, so that
 * filtered breakdowns never count rows outside the window. Pure.
 * @param {Date|string|number|null|undefined} dateValue
 * @param {{ fromMs: number|null, toMs: number|null }} bounds
 * @returns {boolean}
 */
function inPeriod(dateValue, bounds) {
  const { fromMs, toMs } = bounds;
  if (fromMs === null && toMs === null) return true;
  const ms = toMillis(dateValue);
  if (ms === null) return false;
  if (fromMs !== null && ms < fromMs) return false;
  if (toMs !== null && ms > toMs) return false;
  return true;
}

/**
 * Filter a collection to the rows falling inside the period, using `dateKey`
 * (with an optional fallback key). Pure.
 * @param {Array<Object>} rows
 * @param {{ fromMs: number|null, toMs: number|null }} bounds
 * @param {string} dateKey
 * @param {string} [fallbackKey]
 * @returns {Array<Object>}
 */
function filterByPeriod(rows, bounds, dateKey, fallbackKey) {
  if (bounds.fromMs === null && bounds.toMs === null) return rows;
  return rows.filter((row) => {
    const value =
      row[dateKey] ?? (fallbackKey ? row[fallbackKey] : undefined);
    return inPeriod(value, bounds);
  });
}

/**
 * Compute the on-screen report model over already-fetched rows. Reused verbatim
 * by the export endpoint to guarantee numeric identity (Req 10.3).
 *
 * When `period` bounds are supplied, rows are filtered defensively by their
 * timestamp so every breakdown partitions the same in-period set:
 *  - requests / feedback / plots → `createdAt`
 *  - graves → `burialDate`, falling back to `createdAt`
 * When no bounds are supplied, all provided rows are aggregated as-is (the
 * caller is assumed to have fetched exactly the period's rows).
 *
 * Guarantees (Req 11.1–11.4):
 *  - request breakdown emits pending/approved/rejected counts; for inputs whose
 *    statuses are within the recognized set, their sum equals the request total.
 *  - feedback distribution emits a count for every rating bucket 1–5, zeros
 *    included; for in-range ratings their sum equals the feedback total.
 *  - an empty period yields every group present with count 0, never an error.
 *
 * @param {ReportData} [data]
 * @param {ReportPeriod|null} [period]
 * @returns {{
 *   period: { from: string|null, to: string|null },
 *   graves: { total: number, active: number, archived: number },
 *   plots: { total: number, available: number, occupied: number, reserved: number, maintenance: number, occupancyRate: number },
 *   requests: { total: number, byStatus: { pending: number, approved: number, rejected: number } },
 *   feedback: { total: number, averageRating: number, distribution: { 1: number, 2: number, 3: number, 4: number, 5: number } }
 * }}
 */
export function computeReport(data = {}, period = null) {
  const bounds = normalizePeriod(period);

  const graves = filterByPeriod(
    Array.isArray(data.graves) ? data.graves : [],
    bounds,
    "burialDate",
    "createdAt"
  );
  const plots = filterByPeriod(
    Array.isArray(data.plots) ? data.plots : [],
    bounds,
    "createdAt"
  );
  const requests = filterByPeriod(
    Array.isArray(data.requests) ? data.requests : [],
    bounds,
    "createdAt"
  );
  const feedback = filterByPeriod(
    Array.isArray(data.feedback) ? data.feedback : [],
    bounds,
    "createdAt"
  );

  // ── Graves ────────────────────────────────────────────────
  const graveActive = graves.filter((g) => g.status === "active").length;
  const graveArchived = graves.filter((g) => g.status === "archived").length;

  // ── Plots ─────────────────────────────────────────────────
  const plotCounts = PLOT_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  for (const plot of plots) {
    if (Object.prototype.hasOwnProperty.call(plotCounts, plot.status)) {
      plotCounts[plot.status] += 1;
    }
  }
  const occupancyRate =
    plots.length > 0
      ? Math.round((plotCounts.occupied / plots.length) * 100)
      : 0;

  // ── Requests: mutually exclusive status breakdown (Req 11.1, 11.3) ──
  const byStatus = REQUEST_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  for (const req of requests) {
    if (Object.prototype.hasOwnProperty.call(byStatus, req.status)) {
      byStatus[req.status] += 1;
    }
  }

  // ── Feedback: full 1–5 distribution incl. zeros (Req 11.2, 11.3) ──
  const distribution = RATING_BUCKETS.reduce((acc, bucket) => {
    acc[bucket] = 0;
    return acc;
  }, {});
  let ratingSum = 0;
  let ratedCount = 0;
  for (const fb of feedback) {
    const rating = fb.rating;
    if (Object.prototype.hasOwnProperty.call(distribution, rating)) {
      distribution[rating] += 1;
      ratingSum += rating;
      ratedCount += 1;
    }
  }
  const averageRating =
    ratedCount > 0 ? Number((ratingSum / ratedCount).toFixed(1)) : 0;

  return {
    period: {
      from: bounds.fromMs === null ? null : new Date(bounds.fromMs).toISOString(),
      to: bounds.toMs === null ? null : new Date(bounds.toMs).toISOString(),
    },
    graves: {
      total: graves.length,
      active: graveActive,
      archived: graveArchived,
    },
    plots: {
      total: plots.length,
      available: plotCounts.available,
      occupied: plotCounts.occupied,
      reserved: plotCounts.reserved,
      maintenance: plotCounts.maintenance,
      occupancyRate,
    },
    requests: {
      total: requests.length,
      byStatus,
    },
    feedback: {
      total: feedback.length,
      averageRating,
      distribution,
    },
  };
}
