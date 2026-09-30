/**
 * Schematic minimap layout (pure — no React, no Google Maps).
 *
 * Projects plots with a GPS position onto a flat plane in metres (north up) and
 * returns SVG-ready footprints, one label anchor per building, and a view box
 * that fits everything at a fixed aspect ratio. Everything comes from the
 * plots' own data, so any cemetery renders without configuration.
 */

import { getPlotCorners } from "./map-geometry";
import { DEFAULT_GRID_ANGLE_DEG } from "./config";
import { getBuildingKey } from "./cemetery-layout";

const M_LAT = 110574;
const M_LNG = 111320;

/** True when a plot has a usable GPS position. */
export function hasPosition(plot) {
  return (
    plot?.gpsLat != null &&
    plot?.gpsLng != null &&
    Number.isFinite(Number(plot.gpsLat)) &&
    Number.isFinite(Number(plot.gpsLng))
  );
}

/**
 * @param {Array} plots plots with gpsLat/gpsLng (others are ignored)
 * @param {{ angleDeg?: number, padding?: number, aspect?: number, minSpan?: number }} [options]
 * @returns {null | {
 *   shapes: Array<{ plot: object, points: string, cx: number, cy: number }>,
 *   groups: Array<{ key: string, cx: number, top: number }>,
 *   viewBox: { x: number, y: number, w: number, h: number },
 * }}
 */
export function layoutMiniMap(
  plots,
  { angleDeg = DEFAULT_GRID_ANGLE_DEG, padding = 4, aspect = 16 / 9, minSpan = 30 } = {}
) {
  const pinned = (plots || []).filter(hasPosition);
  if (pinned.length === 0) return null;

  const lat0 = pinned.reduce((s, p) => s + Number(p.gpsLat), 0) / pinned.length;
  const lng0 = pinned.reduce((s, p) => s + Number(p.gpsLng), 0) / pinned.length;
  const kx = M_LNG * Math.cos((lat0 * Math.PI) / 180);
  const toXY = (lat, lng) => ({ x: (lng - lng0) * kx, y: -(lat - lat0) * M_LAT });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const shapes = pinned.map((plot) => {
    const corners = getPlotCorners({ lat: Number(plot.gpsLat), lng: Number(plot.gpsLng), angleDeg }).map((c) =>
      toXY(c.lat, c.lng)
    );
    for (const c of corners) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    const center = toXY(Number(plot.gpsLat), Number(plot.gpsLng));
    return {
      plot,
      points: corners.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" "),
      cx: center.x,
      cy: center.y,
    };
  });

  // One label anchor per building: centred above its plots.
  const byBuilding = new Map();
  for (const s of shapes) {
    const key = getBuildingKey(s.plot);
    if (!key) continue;
    const g = byBuilding.get(key) || { sumX: 0, n: 0, top: Infinity };
    g.sumX += s.cx;
    g.n += 1;
    g.top = Math.min(g.top, s.cy);
    byBuilding.set(key, g);
  }
  const groups = [...byBuilding.entries()].map(([key, g]) => ({ key, cx: g.sumX / g.n, top: g.top }));

  // Fit to the content, pad, enforce a minimum span, then match the aspect ratio.
  let w = Math.max(maxX - minX + padding * 2, minSpan);
  let h = Math.max(maxY - minY + padding * 2, minSpan / aspect);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;

  return { shapes, groups, viewBox: { x: cx - w / 2, y: cy - h / 2, w, h } };
}

/**
 * Zoom a view box by `factor` (<1 zooms in) keeping the point (fx, fy) fixed
 * on screen. Zoom is limited relative to the fitted view `fit`.
 */
export function zoomView(view, factor, fx, fy, fit) {
  const minW = fit.w / 12;
  const maxW = fit.w * 1.5;
  const w = Math.min(maxW, Math.max(minW, view.w * factor));
  const k = w / view.w;
  return { x: fx - (fx - view.x) * k, y: fy - (fy - view.y) * k, w, h: view.h * k };
}

/** Shift a view box by (dx, dy) in map units. */
export function panView(view, dx, dy) {
  return { ...view, x: view.x + dx, y: view.y + dy };
}
