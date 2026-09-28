import { describe, it, expect } from "vitest";
import {
  BOLONSORI_PRESET,
  BOLONSORI_ROW_CONFIGS,
  BOLONSORI_DELETED_ROWS,
  applyBolonsoriPreset,
} from "./bolonsori-preset";

describe("bolonsori-preset", () => {
  it("contains exactly 119 plots across 12 active rows", () => {
    expect(BOLONSORI_PRESET.totalPlots).toBe(119);
    const activeRows = Object.keys(BOLONSORI_PRESET.rows);
    expect(activeRows.length).toBe(12);

    let count = 0;
    for (const r of activeRows) {
      count += BOLONSORI_PRESET.rows[r].plots.length;
    }
    expect(count).toBe(119);
  });

  it("has row configs defined for all 12 active rows", () => {
    const activeRows = Object.keys(BOLONSORI_PRESET.rows);
    for (const r of activeRows) {
      const cfg = BOLONSORI_ROW_CONFIGS[r];
      expect(cfg).toBeDefined();
      expect(cfg.numCols).toBe(BOLONSORI_PRESET.rows[r].plotCount);
      expect(cfg.lengthMeters).toBeGreaterThan(15);
      expect(cfg.angleDeg).toBeGreaterThan(25);
      expect(cfg.angleDeg).toBeLessThan(40);
    }
  });

  it("applies preset coordinates to matching plots and sets _modified", () => {
    const testPlots = [
      { id: "p1", plotNumber: "ROW-E01-C01", gpsLat: 0, gpsLng: 0 },
      { id: "p2", plotNumber: "ROW-E01-C02", gpsLat: 0, gpsLng: 0 },
      { id: "p-walag", plotNumber: "WALAG-001", gpsLat: 0, gpsLng: 0 },
    ];

    const result = applyBolonsoriPreset(testPlots);
    const p1 = result.find((p) => p.plotNumber === "ROW-E01-C01");
    expect(p1.gpsLat).toBeCloseTo(8.46599292, 6);
    expect(p1.gpsLng).toBeCloseTo(124.65683591, 6);
    expect(p1._modified).toBe(true);

    const walag = result.find((p) => p.plotNumber === "WALAG-001");
    expect(walag.gpsLat).toBeCloseTo(8.46560824, 6);
    expect(walag.gpsLng).toBeCloseTo(124.65674914, 6);
    expect(walag._modified).toBe(true);
  });

  it("handles deleted rows by unpinning occupied plots and deleting empty ones", () => {
    const testPlots = [
      {
        id: "del-occ",
        plotNumber: "ROW-W01-C02",
        gpsLat: 8.466,
        gpsLng: 124.656,
        graves: [{ id: "g1", deceasedName: "Nimfa Walag" }],
      },
      {
        id: "del-empty",
        plotNumber: "ROW-W01-C01",
        gpsLat: 8.466,
        gpsLng: 124.656,
        graves: [],
      },
    ];

    const result = applyBolonsoriPreset(testPlots);
    const occ = result.find((p) => p.plotNumber === "ROW-W01-C02");
    expect(occ.gpsLat).toBeNull();
    expect(occ.gpsLng).toBeNull();
    expect(occ._modified).toBe(true);
    expect(occ._deleted).toBe(false);

    const empty = result.find((p) => p.plotNumber === "ROW-W01-C01");
    expect(empty._deleted).toBe(true);
    expect(empty._modified).toBe(true);
  });
});
