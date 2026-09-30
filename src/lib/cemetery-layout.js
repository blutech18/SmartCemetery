/**
 * Building / row identity, derived from data (pure — no React, no I/O).
 *
 * A "building" is a multi-tier structure (an apartment crypt row). Plots in it
 * are recognised by their own data, never by a naming convention or database
 * id:
 *
 *  - `Plot.totalTiers > 1` marks a plot as part of a building;
 *  - its building is its section, `plot.locationDetail.subsection`
 *    (new, not-yet-saved plots carry `_buildingKey` instead);
 *  - column order is the trailing number of the plot number.
 *
 * Every layout tool (map, adjuster, grid generator, batch save) uses these
 * helpers so they cannot disagree about what belongs to a building.
 */

/** Absolute upper bound on tiers in one plot. The real limit is `Plot.totalTiers`. */
export const MAX_TIERS = 20;

/** Name prefix for a newly generated row when nothing else identifies one. */
export const DEFAULT_BUILDING_PREFIX = "ROW";

/** True when the plot is part of a multi-tier building. */
export function isBuildingPlot(plot) {
  return Boolean(plot) && Number(plot.totalTiers) > 1;
}

/** The building (row) a plot belongs to, or null for ordinary lots. */
export function getBuildingKey(plot) {
  if (!isBuildingPlot(plot)) return null;
  return plot._buildingKey || plot.locationDetail?.subsection || null;
}

/** True when `plot` belongs to building `key`. */
export function belongsToBuilding(plot, key) {
  return Boolean(key) && key !== "custom" && getBuildingKey(plot) === key;
}

function columnNumber(plot) {
  const m = /(\d+)\s*$/.exec(plot?.plotNumber || "");
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Left-to-right column order: by trailing number, then by plot number. A plot
 * with no column number sorts first.
 */
export function compareByColumn(a, b) {
  const diff = columnNumber(a) - columnNumber(b);
  if (diff !== 0) return diff;
  return String(a?.plotNumber || "").localeCompare(String(b?.plotNumber || ""), undefined, {
    numeric: true,
  });
}

/** Distinct building keys among `plots` (ignoring deleted ones), naturally sorted. */
export function listBuildingKeys(plots) {
  const keys = new Set();
  for (const p of plots || []) {
    if (p?._deleted) continue;
    const key = getBuildingKey(p);
    if (key) keys.add(key);
  }
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Live (not deleted) plots of a building, in column order. */
export function plotsOfBuilding(plots, key) {
  return (plots || [])
    .filter((p) => !p?._deleted && belongsToBuilding(p, key))
    .sort(compareByColumn);
}

/** Human label for a building key ("ROW-E01" → "Row E01"; other keys as-is). */
export function buildingLabel(key) {
  return String(key ?? "").replace(/^ROW-/i, "Row ");
}

/**
 * Section name for a generated plot number: the number without its `-C<nn>`
 * column suffix. Inverse of the naming the grid generator uses, so the client
 * and server agree when a new plot arrives without an explicit section.
 */
export function sectionFromPlotNumber(plotNumber) {
  return String(plotNumber || "").replace(/-C\d+$/i, "");
}

/** Plot-number for column `n` of building `key` (what the grid generator creates). */
export function buildingPlotNumber(key, n) {
  return `${key}-C${String(n).padStart(2, "0")}`;
}

/**
 * Short label for a building cell: its column number without leading zeros
 * ("ROW-E01-C05" → "5", "WALAG-001" → "1"); plot numbers with no trailing
 * number are returned unchanged.
 */
export function columnShortLabel(plotNumber) {
  const m = /(\d+)\s*$/.exec(plotNumber || "");
  return m ? String(parseInt(m[1], 10)) : String(plotNumber ?? "");
}
