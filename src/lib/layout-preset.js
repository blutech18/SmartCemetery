/**
 * Layout preset: the plot layout of a cemetery area, as data.
 *
 * Everything site-specific (location identity, rows, plot positions, per-row
 * building geometry, rows to retire) lives in `layout-preset.json`; nothing
 * here knows a row name or a count. Swapping that file swaps the layout.
 *
 * This module is client-safe (pure). The database side is in
 * `layout-preset-db.js`.
 */

import presetJson from "./layout-preset.json";
import { DEFAULT_BUILDING_TIERS } from "./config";
import { getBuildingKey, sectionFromPlotNumber } from "./cemetery-layout";

export const LAYOUT_PRESET = presetJson;

/** Per-row building geometry (centre, size, angle, columns) keyed by row. */
export const LAYOUT_ROW_CONFIGS = presetJson.rowConfigs ?? {};

/** Rows the layout retires: empty plots are removed, occupied ones are unpinned. */
export const LAYOUT_DELETED_ROWS = presetJson.deletedRows ?? [];

/** Tiers per plot in this layout (falls back to the configured default). */
export function presetTiers(preset = LAYOUT_PRESET) {
  const n = Number(preset?.tiersPerPlot);
  return Number.isInteger(n) && n > 1 ? n : DEFAULT_BUILDING_TIERS;
}

/** Name, row count and total plot count, computed from the data. */
export function summarizePreset(preset = LAYOUT_PRESET) {
  const rows = Object.values(preset?.rows ?? {});
  return {
    name: preset?.name ?? "Layout preset",
    rowCount: rows.length,
    totalPlots: rows.reduce((sum, r) => sum + (r.plots?.length ?? 0), 0),
  };
}

export const LAYOUT_PRESET_SUMMARY = summarizePreset();

/** The building config to show first after applying a preset (its first row). */
export function defaultRowConfig(configs = LAYOUT_ROW_CONFIGS) {
  return Object.values(configs)[0] ?? null;
}

/**
 * Applies the preset's coordinates to a list of plots.
 *
 * @param {Array} currentPlots Current array of plots from the map/store
 * @param {object} [preset]
 * @returns {Array} Updated plots: matching plots repositioned, plots in retired
 *   rows unpinned (occupied) or flagged for deletion (empty), and any preset
 *   plot that does not exist yet added as a new plot.
 */
export function applyLayoutPreset(currentPlots = [], preset = LAYOUT_PRESET) {
  const tiers = presetTiers(preset);
  const deletedRows = new Set(preset?.deletedRows ?? []);

  // plotNumber → { plot definition, row key }
  const presetMap = new Map();
  for (const [rowKey, rowData] of Object.entries(preset?.rows ?? {})) {
    for (const plot of rowData.plots) {
      presetMap.set(plot.plotNumber, { plot, rowKey });
    }
  }

  const updatedPlotNumbers = new Set();
  const updatedPlots = currentPlots.map((plot) => {
    const match = presetMap.get(plot.plotNumber);
    if (match) {
      updatedPlotNumbers.add(plot.plotNumber);
      return {
        ...plot,
        gpsLat: match.plot.lat,
        gpsLng: match.plot.lng,
        _modified: true,
        _deleted: false,
      };
    }

    // Plot in a retired row?
    const row = getBuildingKey(plot) ?? plot.locationDetail?.subsection ?? sectionFromPlotNumber(plot.plotNumber);
    if (deletedRows.has(row)) {
      const hasGraves = Array.isArray(plot.graves) && plot.graves.length > 0;
      if (hasGraves) {
        // Protect occupied plots: unpin to the unplaced list
        return { ...plot, gpsLat: null, gpsLng: null, _modified: true, _deleted: false };
      }
      // Delete empty plots
      return { ...plot, _modified: true, _deleted: true };
    }

    return plot;
  });

  // Preset plots that are not in the list yet become new plots
  for (const [plotNumber, { plot, rowKey }] of presetMap.entries()) {
    if (!updatedPlotNumbers.has(plotNumber)) {
      updatedPlots.push({
        plotNumber,
        gpsLat: plot.lat,
        gpsLng: plot.lng,
        status: plot.status || "available",
        totalTiers: tiers,
        _buildingKey: rowKey,
        _isNew: true,
        _modified: true,
        _deleted: false,
      });
    }
  }

  return updatedPlots;
}
