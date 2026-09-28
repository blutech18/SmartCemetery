import { describe, it, expect } from "vitest";
import {
  formatPlotDate,
  getOrdinal,
  getInitials,
  extractPlotTiers,
  getPlotSummaryNames,
  statusMeta,
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

  it("derives tiers from real grave records and never fabricates occupants", () => {
    const plot = {
      plotNumber: "ROW-W07-C01",
      locationDetail: { subsection: "ROW-W07" },
      status: "occupied",
      graves: [
        {
          id: 1,
          deceasedName: "Real Person",
          burialDate: "2020-01-01",
          details: { causeOfDeath: "x", contactPerson: "Kin" },
        },
      ],
    };
    const tiers = extractPlotTiers(plot);
    const occupant = tiers.find((t) => t.status === "occupied");
    expect(occupant.deceasedName).toBe("Real Person");
    // No hardcoded "Walag" data may appear for an unrelated row plot.
    expect(tiers.some((t) => (t.deceasedName || "").includes("Walag"))).toBe(false);
  });

  it("parses an explicit apartment niche stack", () => {
    const plot = {
      graves: [
        {
          details: {
            notes: JSON.stringify({
              type: "apartment_niche_stack",
              tiers: [{ tier: 1, deceasedName: "A", status: "occupied" }],
            }),
          },
        },
      ],
    };
    const tiers = extractPlotTiers(plot);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].deceasedName).toBe("A");
  });

  it("summarizes combined names from a single grave string", () => {
    expect(
      getPlotSummaryNames({ plotNumber: "X", graves: [{ deceasedName: "A & B" }] })
    ).toEqual(["A", "B"]);
    expect(
      getPlotSummaryNames({ plotNumber: "X", graves: [{ deceasedName: "A / B" }] })
    ).toEqual(["A", "B"]);
    expect(
      getPlotSummaryNames({ plotNumber: "X", graves: [{ deceasedName: "A and B" }] })
    ).toEqual(["A", "B"]);
  });

  it("maps statuses to presentation metadata with a safe default", () => {
    expect(statusMeta("occupied").label).toBe("Occupied");
    expect(statusMeta("available").label).toBe("Available");
    expect(statusMeta("hold").label).toBe("Hold / Reserved");
    expect(statusMeta("something-else").label).toBe("Unavailable");
  });
});
