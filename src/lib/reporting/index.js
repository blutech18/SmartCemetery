/**
 * Reporting module public surface.
 *
 * Re-exports the pure report computation used by both the stats endpoint
 * (GET /api/reports/stats) and the export endpoint (GET /api/reports/export),
 * ensuring on-screen and exported values are numerically identical (Req 10.3).
 */
export {
  computeReport,
  REQUEST_STATUSES,
  RATING_BUCKETS,
  PLOT_STATUSES,
} from "./compute.js";
