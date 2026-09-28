/**
 * Pure geospatial transform helpers for batch plot editing.
 *
 * Extracted from `PlotPositionAdjuster.js` so that `CemeteryMap.js` (and any
 * other consumer) can import them without pulling in the 2.8k-line adjuster
 * component. All functions are pure and operate on an array of plot-like
 * objects `{ gpsLat, gpsLng, ... }`.
 */

/** Metres per degree of latitude (constant). */
export const M_TO_LAT = 1 / 110574;

/** Degrees of longitude per metre at a given latitude. */
export function mToLng(lat = 8.4657) {
  return 1 / (111320 * Math.cos((lat * Math.PI) / 180));
}

/**
 * True when a plot has usable, finite GPS coordinates. Guards against latitude
 * 0 (which is falsy) as well as null/undefined/non-numeric values.
 */
function hasFiniteGps(p) {
  if (p?.gpsLat == null || p?.gpsLng == null) return false;
  return Number.isFinite(Number(p.gpsLat)) && Number.isFinite(Number(p.gpsLng));
}

/** Translate an array of plots by dLat, dLng (optionally filtered). */
export function translatePlots(plots, dLat, dLng, filterFn = null) {
  return plots.map((p) => {
    if (filterFn && !filterFn(p)) return p;
    if (!hasFiniteGps(p)) return p;
    return {
      ...p,
      gpsLat: Number((Number(p.gpsLat) + dLat).toFixed(8)),
      gpsLng: Number((Number(p.gpsLng) + dLng).toFixed(8)),
      _modified: true,
    };
  });
}

/** Rotate an array of plots around (centerLat, centerLng) by deltaDeg. */
export function rotatePlots(plots, centerLat, centerLng, deltaDeg, filterFn = null) {
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lngScale = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const latScale = 110574;

  return plots.map((p) => {
    if (filterFn && !filterFn(p)) return p;
    if (!hasFiniteGps(p)) return p;

    // Convert to metres relative to centre.
    const y = (Number(p.gpsLat) - centerLat) * latScale;
    const x = (Number(p.gpsLng) - centerLng) * lngScale;

    // Rotate.
    const xRot = x * cos - y * sin;
    const yRot = x * sin + y * cos;

    return {
      ...p,
      gpsLat: Number((centerLat + yRot / latScale).toFixed(8)),
      gpsLng: Number((centerLng + xRot / lngScale).toFixed(8)),
      _modified: true,
    };
  });
}

/** Scale an array of plots relative to centre by `scaleFactor`. */
export function scalePlots(plots, centerLat, centerLng, scaleFactor, filterFn = null) {
  return plots.map((p) => {
    if (filterFn && !filterFn(p)) return p;
    if (!hasFiniteGps(p)) return p;

    const lat = Number(p.gpsLat);
    const lng = Number(p.gpsLng);

    return {
      ...p,
      gpsLat: Number((centerLat + (lat - centerLat) * scaleFactor).toFixed(8)),
      gpsLng: Number((centerLng + (lng - centerLng) * scaleFactor).toFixed(8)),
      _modified: true,
    };
  });
}

/** Bounding box + centre of a collection of plots, with ~1.5 m padding. */
export function getPlotsBoundingBox(plots, filterFn = null) {
  let target = filterFn ? plots.filter(filterFn) : plots;
  if (!filterFn) {
    const cmpOnly = target.filter(
      (p) =>
        p.plotNumber?.startsWith("ROW-") ||
        p.plotNumber === "WALAG-001" ||
        p.locationDetail?.subsection?.startsWith("ROW-")
    );
    if (cmpOnly.length > 0) target = cmpOnly;
  }
  const valid = target.filter(hasFiniteGps);
  if (valid.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let sumLat = 0;
  let sumLng = 0;

  for (const p of valid) {
    const lat = Number(p.gpsLat);
    const lng = Number(p.gpsLng);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    sumLat += lat;
    sumLng += lng;
  }

  const centerLat = sumLat / valid.length;
  const centerLng = sumLng / valid.length;

  const latPad = 1.5 * M_TO_LAT;
  const lngPad = 1.5 * mToLng(centerLat);

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
    centerLat,
    centerLng,
    count: valid.length,
  };
}
