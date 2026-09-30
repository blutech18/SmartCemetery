import { describe, it, expect } from "vitest";
import {
  formatPlotDate,
  getOrdinal,
  getInitials,
  extractPlotTiers,
  getPlotSummaryNames,
  getPlotOccupantNames,
  getPlotPhoto,
  statusMeta,
  getGravePhoto,
  tierLabel,
} from "./plot-format";

describe("plot-format", () => {
  it("formats dates in UTC so date-only values never shift a day", () => {
    expect(formatPlotDate("2021-10-14")).toBe("October 14th, 2021");
    expect(formatPlotDate("2018-03-20T00:00:00.000Z")).toBe("March 20th, 2018");
    // Late-UTC timestamp would render the previous day under local getters in
    // negative-UTC timezones; UTC getters keep it correct.
    expect(formatPlotDate("2018-01-01T23:30:00.000Z")).toBe("January 1st, 2018");
  });

  it("returns placeholders for empty/undefined and raw input for invalid", () => {
    expect(formatPlotDate("")).toBe("—");
    expect(formatPlotDate(null)).toBe("—");
    expect(formatPlotDate(undefined)).toBe("—");
    expect(formatPlotDate("not-a-date")).toBe("not-a-date");
  });

  it("appends correct ordinal suffixes", () => {
    expect(getOrdinal(1)).toBe("1st");
    expect(getOrdinal(2)).toBe("2nd");
    expect(getOrdinal(3)).toBe("3rd");
    expect(getOrdinal(4)).toBe("4th");
    expect(getOrdinal(11)).toBe("11th");
    expect(getOrdinal(22)).toBe("22nd");
    expect(getOrdinal(103)).toBe("103rd");
  });

  it("derives initials", () => {
    expect(getInitials("Beatriz Walag")).toBe("BW");
    expect(getInitials("Madonna")).toBe("MA");
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
  });


  it("labels tiers for single lots and stacks", () => {
    expect(tierLabel(1, 1)).toBe("Ground Burial Lot");
    expect(tierLabel(1, 4)).toBe("Tier 1 (Ground Level)");
    expect(tierLabel(3, 4)).toBe("Tier 3 (Third Level)");
    expect(tierLabel(4, 4)).toBe("Tier 4 (Top Level)");
  });

  it("derives tiers from real grave rows and never fabricates occupants", () => {
    const plot = {
      plotNumber: "ROW-W07-C01",
      locationDetail: { subsection: "ROW-W07" },
      totalTiers: 4,
      status: "occupied",
      graves: [
        {
          id: 1,
          tier: 1,
          status: "active",
          deceasedName: "Real Person",
          burialDate: "2020-01-01",
          birthDate: "1940-02-15",
          deathDate: "2020-01-01",
          details: { causeOfDeath: "x", contactPerson: "Kin", notes: "remarks" },
        },
      ],
    };
    const tiers = extractPlotTiers(plot);
    expect(tiers).toHaveLength(4);
    const occupant = tiers.find((t) => t.status === "occupied");
    expect(occupant).toMatchObject({
      id: 1,
      deceasedName: "Real Person",
      birthDate: "1940-02-15",
      deathDate: "2020-01-01",
      notes: "remarks",
    });
    expect(tiers.filter((t) => t.status === "available")).toHaveLength(3);
    expect(formatPlotDate(occupant.birthDate)).toBe("February 15th, 1940");
  });

  it("uses Plot.totalTiers and treats a plot with no grave as available", () => {
    expect(extractPlotTiers({ plotNumber: "A-1", totalTiers: 1, status: "available", graves: [] })).toEqual([
      { tier: 1, label: "Ground Burial Lot", status: "available", photo: null },
    ]);
    expect(extractPlotTiers({ plotNumber: "A-1", totalTiers: 3, graves: [] })).toHaveLength(3);
    expect(extractPlotTiers(null)).toEqual([]);
  });

  it("never shows fewer tiers than the highest grave tier", () => {
    const plot = { plotNumber: "A-1", totalTiers: 1, graves: [{ id: 1, tier: 3, deceasedName: "X", status: "active" }] };
    expect(extractPlotTiers(plot)).toHaveLength(3);
  });

  it("resolves tier photos from PlotPhoto rows with plot-wide fallback", () => {
    const plot = {
      plotNumber: "ROW-1",
      totalTiers: 4,
      photos: [
        { tier: 0, url: "/plot.jpg" },
        { tier: 2, url: "/t2.jpg" },
      ],
      graves: [],
    };
    const tiers = extractPlotTiers(plot);
    expect(tiers.find((t) => t.tier === 2).photo).toBe("/t2.jpg");
    expect(tiers.find((t) => t.tier === 1).photo).toBe("/plot.jpg");
    expect(getPlotPhoto(plot)).toBe("/plot.jpg");
    expect(getPlotPhoto({})).toBeNull();
  });

  it("gets a grave's photo from its plot's photos", () => {
    const grave = { tier: 2, plot: { photos: [{ tier: 0, url: "/p.jpg" }, { tier: 2, url: "/t2.jpg" }] } };
    expect(getGravePhoto(grave)).toBe("/t2.jpg");
    expect(getGravePhoto({ tier: 3, plot: grave.plot })).toBe("/p.jpg");
    expect(getGravePhoto(null)).toBeNull();
    expect(getGravePhoto({})).toBeNull();
  });

  it("lists occupant names in tier order and splits a single combined name", () => {
    expect(
      getPlotOccupantNames({ graves: [{ tier: 2, deceasedName: "B" }, { tier: 1, deceasedName: "A" }] })
    ).toEqual(["A", "B"]);
    expect(getPlotOccupantNames({ graves: [{ deceasedName: "A & B" }] })).toEqual(["A", "B"]);
    expect(getPlotOccupantNames({ graves: [{ deceasedName: "A / B" }] })).toEqual(["A", "B"]);
    expect(getPlotOccupantNames({ graves: [{ deceasedName: "A and B" }] })).toEqual(["A", "B"]);
    expect(getPlotOccupantNames({ graves: [] })).toEqual([]);
  });

  it("summary names fall back to the plot number", () => {
    expect(getPlotSummaryNames({ plotNumber: "X", graves: [] })).toEqual(["Plot X"]);
    expect(getPlotSummaryNames({ plotNumber: "X", graves: [{ deceasedName: "A" }] })).toEqual(["A"]);
    expect(getPlotSummaryNames(null)).toEqual([]);
  });

  it("maps statuses to presentation metadata with a safe default", () => {
    expect(statusMeta("occupied").label).toBe("Occupied");
    expect(statusMeta("available").label).toBe("Available");
    expect(statusMeta("hold").label).toBe("Hold / Reserved");
    expect(statusMeta("something-else").label).toBe("Unavailable");
  });
});
