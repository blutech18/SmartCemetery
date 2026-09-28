import { describe, it, expect } from "vitest";
import {
  translatePlots,
  rotatePlots,
  scalePlots,
  getPlotsBoundingBox,
  M_TO_LAT,
  mToLng,
} from "./geo";

describe("geo transforms", () => {
  it("translates finite GPS plots and marks them modified", () => {
    const [p] = translatePlots([{ id: 1, gpsLat: 8.5, gpsLng: 124.6 }], 0.0001, 0.0001);
    expect(p.gpsLat).toBeCloseTo(8.5001, 6);
    expect(p.gpsLng).toBeCloseTo(124.6001, 6);
    expect(p._modified).toBe(true);
  });

  it("does not skip a valid latitude of 0 (falsy-guard regression)", () => {
    const [p] = translatePlots([{ id: 1, gpsLat: 0, gpsLng: 0 }], 0.001, 0.001);
    expect(p.gpsLat).toBeCloseTo(0.001, 6);
    expect(p.gpsLng).toBeCloseTo(0.001, 6);
    expect(p._modified).toBe(true);
  });

  it("leaves plots without usable GPS untouched", () => {
    const plots = [
      { id: 1, gpsLat: null, gpsLng: null },
      { id: 2, gpsLat: "abc", gpsLng: 124.6 },
    ];
    expect(translatePlots(plots, 0.1, 0.1)[0]).toEqual(plots[0]);
    expect(translatePlots(plots, 0.1, 0.1)[1]).toEqual(plots[1]);
  });

  it("respects the scope filter function", () => {
    const [p] = translatePlots(
      [{ id: 1, gpsLat: 8.5, gpsLng: 124.6, plotNumber: "ROW-E01" }],
      0.1,
      0.1,
      () => false
    );
    expect(p.gpsLat).toBe(8.5);
    expect(p._modified).toBeUndefined();
  });

  it("computes a bounding box that includes latitude 0", () => {
    const box = getPlotsBoundingBox([{ id: 1, gpsLat: 0, gpsLng: 0 }]);
    expect(box).not.toBeNull();
    expect(box.count).toBe(1);
    expect(box.centerLat).toBeCloseTo(0, 6);
  });

  it("returns null for an empty/no-GPS collection", () => {
    expect(getPlotsBoundingBox([])).toBeNull();
    expect(getPlotsBoundingBox([{ id: 1, gpsLat: null, gpsLng: null }])).toBeNull();
  });

  it("rotates around a centre and marks plots modified", () => {
    const [p] = rotatePlots([{ id: 1, gpsLat: 8.5, gpsLng: 124.6 }], 8.5, 124.6, 90);
    expect(p._modified).toBe(true);
    expect(p.gpsLat).toBeCloseTo(8.5, 6);
  });

  it("scales around a centre", () => {
    const [p] = scalePlots([{ id: 1, gpsLat: 8.501, gpsLng: 124.6 }], 8.5, 124.6, 0.5);
    expect(p.gpsLat).toBeCloseTo(8.5005, 6);
  });

  it("exports positive conversion constants", () => {
    expect(M_TO_LAT).toBeGreaterThan(0);
    expect(mToLng(8.4657)).toBeGreaterThan(0);
  });
});
