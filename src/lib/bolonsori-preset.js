/**
 * Bolonsiri Master Plot & Building Layout Preset
 *
 * Captures the exact localdev plot design aligned to physical concrete
 * apartment foundations and drone imagery at City Memorial Park (CMP) - Bolonsiri.
 *
 * Total: 12 Active Apartment Rows, 119 Pinned Plots.
 * Removed Rows (Clean Foundations): ROW-W01, ROW-W02, ROW-W04.
 */

import presetJson from "./bolonsori-preset.json";

export const BOLONSORI_PRESET = presetJson;

export const BOLONSORI_DELETED_ROWS = ["ROW-W01", "ROW-W02", "ROW-W04"];

/**
 * Pre-computed building bounding box configurations for each row in the preset.
 */
export const BOLONSORI_ROW_CONFIGS = {
  "ROW-E01": {
    targetRow: "ROW-E01",
    numCols: 9,
    numRows: 1,
    centerLat: 8.46604176,
    centerLng: 124.65691851,
    lengthMeters: 23.8,
    widthMeters: 2.8,
    angleDeg: 30.7,
    invertCols: false,
  },
  "ROW-E02": {
    targetRow: "ROW-E02",
    numCols: 12,
    numRows: 1,
    centerLat: 8.46598772,
    centerLng: 124.65701322,
    lengthMeters: 35.0,
    widthMeters: 2.8,
    angleDeg: 32.2,
    invertCols: false,
  },
  "ROW-E03": {
    targetRow: "ROW-E03",
    numCols: 15,
    numRows: 1,
    centerLat: 8.46592904,
    centerLng: 124.65709441,
    lengthMeters: 46.3,
    widthMeters: 2.8,
    angleDeg: 31.8,
    invertCols: false,
  },
  "ROW-E04": {
    targetRow: "ROW-E04",
    numCols: 12,
    numRows: 1,
    centerLat: 8.46595015,
    centerLng: 124.65730788,
    lengthMeters: 28.8,
    widthMeters: 2.8,
    angleDeg: 30.4,
    invertCols: false,
  },
  "ROW-E05": {
    targetRow: "ROW-E05",
    numCols: 12,
    numRows: 1,
    centerLat: 8.46587802,
    centerLng: 124.65738086,
    lengthMeters: 33.5,
    widthMeters: 2.8,
    angleDeg: 29.5,
    invertCols: false,
  },
  "ROW-E06": {
    targetRow: "ROW-E06",
    numCols: 8,
    numRows: 1,
    centerLat: 8.46579771,
    centerLng: 124.6570588,
    lengthMeters: 21.2,
    widthMeters: 2.8,
    angleDeg: 31.9,
    invertCols: false,
  },
  "ROW-E07": {
    targetRow: "ROW-E07",
    numCols: 9,
    numRows: 1,
    centerLat: 8.46572245,
    centerLng: 124.6571064,
    lengthMeters: 24.3,
    widthMeters: 2.8,
    angleDeg: 32.1,
    invertCols: false,
  },
  "ROW-W03": {
    targetRow: "ROW-W03",
    numCols: 9,
    numRows: 1,
    centerLat: 8.46549931,
    centerLng: 124.65692294,
    lengthMeters: 25.5,
    widthMeters: 2.8,
    angleDeg: 31.0,
    invertCols: false,
  },
  "ROW-W05": {
    targetRow: "ROW-W05",
    numCols: 8,
    numRows: 1,
    centerLat: 8.46564061,
    centerLng: 124.65715176,
    lengthMeters: 23.1,
    widthMeters: 2.8,
    angleDeg: 31.4,
    invertCols: false,
  },
  "ROW-W06": {
    targetRow: "ROW-W06",
    numCols: 8,
    numRows: 1,
    centerLat: 8.46572832,
    centerLng: 124.65677791,
    lengthMeters: 22.8,
    widthMeters: 2.8,
    angleDeg: 33.0,
    invertCols: false,
  },
  "ROW-W07": {
    targetRow: "ROW-W07",
    numCols: 8,
    numRows: 1,
    centerLat: 8.46565727,
    centerLng: 124.65682613,
    lengthMeters: 22.8,
    widthMeters: 2.8,
    angleDeg: 32.6,
    invertCols: false,
  },
  "ROW-W08": {
    targetRow: "ROW-W08",
    numCols: 9,
    numRows: 1,
    centerLat: 8.46557751,
    centerLng: 124.65687181,
    lengthMeters: 25.1,
    widthMeters: 2.8,
    angleDeg: 32.1,
    invertCols: false,
  },
};

/**
 * Applies the Bolonsiri preset coordinates to a list of plots.
 *
 * @param {Array} currentPlots Current array of plots from the map/store
 * @returns {Array} Updated array of plots with exact coordinates from the preset
 */
export function applyBolonsoriPreset(currentPlots = []) {
  // Build lookup of preset plot coordinates
  const presetMap = new Map();
  for (const rowData of Object.values(BOLONSORI_PRESET.rows)) {
    for (const plot of rowData.plots) {
      presetMap.set(plot.plotNumber, plot);
    }
  }

  const updatedPlotNumbers = new Set();
  const updatedPlots = currentPlots.map((plot) => {
    const presetPlot = presetMap.get(plot.plotNumber);
    if (presetPlot) {
      updatedPlotNumbers.add(plot.plotNumber);
      return {
        ...plot,
        gpsLat: presetPlot.lat,
        gpsLng: presetPlot.lng,
        _modified: true,
        _deleted: false,
      };
    }

    // Check if plot belongs to one of the deleted rows (ROW-W01, ROW-W02, ROW-W04)
    const rowPrefix = plot.plotNumber?.slice(0, 7);
    if (BOLONSORI_DELETED_ROWS.includes(rowPrefix)) {
      const hasGraves = Array.isArray(plot.graves) && plot.graves.length > 0;
      if (hasGraves) {
        // Protect occupied plots: unpin to unplaced list
        return {
          ...plot,
          gpsLat: null,
          gpsLng: null,
          _modified: true,
          _deleted: false,
        };
      } else {
        // Delete empty plots
        return {
          ...plot,
          _modified: true,
          _deleted: true,
        };
      }
    }

    // Unmodified existing plot
    return plot;
  });

  // If any preset plot wasn't found in currentPlots, add it as a new plot
  for (const [plotNumber, presetPlot] of presetMap.entries()) {
    if (!updatedPlotNumbers.has(plotNumber)) {
      updatedPlots.push({
        plotNumber,
        gpsLat: presetPlot.lat,
        gpsLng: presetPlot.lng,
        status: presetPlot.status || "available",
        _isNew: true,
        _modified: true,
        _deleted: false,
      });
    }
  }

  return updatedPlots;
}
