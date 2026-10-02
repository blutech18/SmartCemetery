import { describe, it, expect } from "vitest";
import { hasPosition, layoutMiniMap, zoomView, panView } from "@/lib/minimap";
import { localOffsetToLatLng } from "@/lib/building-grid";

const at = (id, dx, dy, extra = {}) => {
  const p = localOffsetToLatLng(dx, dy, 8.4658, 124.657, 30);
  return { id, plotNumber: `P-${id}`, gpsLat: p.lat, gpsLng: p.lng, ...extra };
};
const building = (id, dx, dy, section) =>
  at(id, dx, dy, { totalTiers: 4, locationDetail: { subsection: section } });

describe("minimap layout", () => {
  it("ignores plots without a position and returns null when none have one", () => {
    expect(layoutMiniMap([])).toBeNull();
    expect(layoutMiniMap([{ id: 1, gpsLat: null, gpsLng: null }])).toBeNull();
    expect(hasPosition({ gpsLat: "8.4", gpsLng: "124.6" })).toBe(true);
    expect(hasPosition({ gpsLat: "x", gpsLng: 1 })).toBe(false);
    const map = layoutMiniMap([at(1, 0, 0), { id: 2, gpsLat: null, gpsLng: null }]);
    expect(map.shapes).toHaveLength(1);
  });

  it("produces a four-corner footprint per plot, centred on its position", () => {
    const map = layoutMiniMap([at(1, -10, 0), at(2, 10, 0)]);
    expect(map.shapes).toHaveLength(2);
    for (const s of map.shapes) expect(s.points.split(" ")).toHaveLength(4);
    // plots 20 m apart along the row axis
    const d = Math.hypot(map.shapes[0].cx - map.shapes[1].cx, map.shapes[0].cy - map.shapes[1].cy);
    expect(d).toBeGreaterThan(19.5);
    expect(d).toBeLessThan(20.5);
  });

  it("puts north at the top (y decreases as latitude increases)", () => {
    const north = { id: 1, gpsLat: 8.466, gpsLng: 124.657 };
    const south = { id: 2, gpsLat: 8.465, gpsLng: 124.657 };
    const map = layoutMiniMap([north, south]);
    const n = map.shapes.find((s) => s.plot.id === 1);
    const s = map.shapes.find((s) => s.plot.id === 2);
    expect(n.cy).toBeLessThan(s.cy);
  });

  it("fits every plot inside a view box with the requested aspect ratio", () => {
    const plots = [at(1, -40, -20), at(2, 40, 20), at(3, 0, 0)];
    const { viewBox, shapes } = layoutMiniMap(plots, { aspect: 16 / 9 });
    expect(viewBox.w / viewBox.h).toBeCloseTo(16 / 9, 3);
    for (const s of shapes) {
      expect(s.cx).toBeGreaterThan(viewBox.x);
      expect(s.cx).toBeLessThan(viewBox.x + viewBox.w);
      expect(s.cy).toBeGreaterThan(viewBox.y);
      expect(s.cy).toBeLessThan(viewBox.y + viewBox.h);
    }
  });

  it("never collapses to a point for a single plot", () => {
    const { viewBox } = layoutMiniMap([at(1, 0, 0)], { minSpan: 30 });
    expect(viewBox.w).toBeGreaterThanOrEqual(30);
    expect(viewBox.h).toBeGreaterThan(0);
  });

  it("labels each building once, from its own section, and leaves ordinary lots unlabelled", () => {
    const plots = [
      building(1, -5, 0, "Crypt Block 2"),
      building(2, 5, 0, "Crypt Block 2"),
      building(3, 0, 30, "Wing A"),
      at(4, 50, 50), // ordinary lot (no tiers)
    ];
    const { groups } = layoutMiniMap(plots);
    expect(groups.map((g) => g.key).sort()).toEqual(["Crypt Block 2", "Wing A"]);
    const crypt = groups.find((g) => g.key === "Crypt Block 2");
    expect(Number.isFinite(crypt.cx) && Number.isFinite(crypt.top)).toBe(true);
  });
});

describe("minimap zoom and pan", () => {
  const fit = { x: 0, y: 0, w: 160, h: 90 };

  it("zooms about a fixed point and keeps the aspect ratio", () => {
    const v = zoomView(fit, 0.5, 80, 45, fit);
    expect(v.w).toBeCloseTo(80);
    expect(v.h).toBeCloseTo(45);
    // the focus point stays where it was on screen
    expect((80 - v.x) / v.w).toBeCloseTo((80 - fit.x) / fit.w);
    expect((45 - v.y) / v.h).toBeCloseTo((45 - fit.y) / fit.h);
  });

  it("limits how far you can zoom in or out", () => {
    let v = fit;
    for (let i = 0; i < 40; i += 1) v = zoomView(v, 0.5, 80, 45, fit);
    expect(v.w).toBeCloseTo(fit.w / 12);
    v = fit;
    for (let i = 0; i < 40; i += 1) v = zoomView(v, 2, 80, 45, fit);
    expect(v.w).toBeCloseTo(fit.w * 1.5);

    // configurable maxZoom
    let vCustom = fit;
    for (let i = 0; i < 40; i += 1) vCustom = zoomView(vCustom, 0.5, 80, 45, fit, 5);
    expect(vCustom.w).toBeCloseTo(fit.w / 5);
  });

  it("pans without changing the zoom", () => {
    expect(panView(fit, 5, -3)).toEqual({ x: 5, y: -3, w: 160, h: 90 });
  });
});
