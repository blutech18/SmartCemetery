import { describe, it, expect } from "vitest";
import { planPlotBackfill, parseLegacyNotes, parseLooseDate } from "@/lib/legacy-notes";

const grave = (over = {}) => ({
  id: 1,
  tier: 1,
  deceasedName: "Plot ROW-A01",
  burialDate: null,
  birthDate: null,
  deathDate: null,
  verificationStatus: "verified",
  verifiedAt: new Date("2024-01-01"),
  verifiedById: 9,
  verificationNote: "ok",
  details: { causeOfDeath: null, contactPerson: null, contactPhone: null, notes: null },
  ...over,
});
const plot = (over = {}) => ({ id: 10, plotNumber: "ROW-A01", totalTiers: 1, graves: [], photos: [], ...over });
const stackNotes = (tiers, extra = {}) =>
  JSON.stringify({ type: "apartment_niche_stack", totalTiers: 4, tiers, ...extra });

describe("parse helpers", () => {
  it("only treats JSON objects as legacy notes", () => {
    expect(parseLegacyNotes("hello")).toBeNull();
    expect(parseLegacyNotes("[1]")).toBeNull();
    expect(parseLegacyNotes("{bad")).toBeNull();
    expect(parseLegacyNotes('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses dates loosely and rejects junk", () => {
    expect(parseLooseDate("2021-10-10")?.getUTCFullYear()).toBe(2021);
    expect(parseLooseDate("not a date")).toBeNull();
    expect(parseLooseDate("0001-01-01")).toBeNull();
    expect(parseLooseDate(null)).toBeNull();
  });
});

describe("planPlotBackfill — apartment stack", () => {
  const tiers = [
    { tier: 1, status: "occupied", deceasedName: "Beatriz Walag", deathDate: "2018-03-16", causeOfDeath: "Old age", contactPerson: "Nimfa", notes: "Mother", photo: "/a.png" },
    { tier: 2, status: "occupied", deceasedName: "Nimfa Walag", deathDate: "2021-10-10", burialDate: "2021-10-14T00:00:00.000Z" },
    { tier: 3, status: "available" },
    { tier: 4, status: "available" },
  ];
  const container = grave({
    deceasedName: "Beatriz and Nimfa Walag",
    burialDate: new Date("2021-10-14"),
    details: { causeOfDeath: "combined", contactPerson: "Roberto", contactPhone: "+63 918", notes: stackNotes(tiers, { photo: "/plot.png" }) },
  });

  it("converts the tier-1 container into the tier-1 occupant and creates the others", () => {
    const plan = planPlotBackfill(plot({ graves: [container] }));
    expect(plan.graveDeletes).toEqual([]);
    const upd = plan.graveUpdates.find((u) => u.id === 1);
    expect(upd.data.deceasedName).toBe("Beatriz Walag");
    expect(upd.data.deathDate.getUTCFullYear()).toBe(2018);
    expect(upd.details).toMatchObject({ causeOfDeath: "Old age", contactPerson: "Nimfa", contactPhone: "+63 918", notes: "Mother" });

    expect(plan.graveCreates).toHaveLength(1);
    const c = plan.graveCreates[0];
    expect(c.tier).toBe(2);
    expect(c.data).toMatchObject({ plotId: 10, deceasedName: "Nimfa Walag", verificationStatus: "verified", verifiedById: 9 });
    expect(c.data.burialDate.toISOString()).toBe("2021-10-14T00:00:00.000Z");
  });

  it("moves photos to plot-wide and per-tier rows, and sets totalTiers", () => {
    const plan = planPlotBackfill(plot({ graves: [container] }));
    expect(plan.photos).toEqual(expect.arrayContaining([{ tier: 0, url: "/plot.png" }, { tier: 1, url: "/a.png" }]));
    expect(plan.totalTiers).toBe(4);
  });

  it("does not overwrite an existing photo for a tier", () => {
    const plan = planPlotBackfill(plot({ graves: [container], photos: [{ tier: 1 }] }));
    expect(plan.photos.find((p) => p.tier === 1)).toBeUndefined();
  });

  it("deletes a pure placeholder container and never loses occupants", () => {
    const holder = grave({ details: { notes: stackNotes([{ tier: 1, status: "available" }, { tier: 2, status: "occupied", deceasedName: "A B" }]) } });
    const plan = planPlotBackfill(plot({ graves: [holder] }));
    expect(plan.graveDeletes).toEqual([1]);
    expect(plan.graveCreates.map((c) => c.tier)).toEqual([2]);
  });

  it("merges into an existing real grave on the same tier instead of duplicating", () => {
    const holder = grave({ details: { notes: stackNotes([{ tier: 2, status: "occupied", deceasedName: "Real One", deathDate: "2020-01-02", notes: "n" }]) } });
    const real = grave({ id: 2, tier: 2, deceasedName: "Real One", details: { causeOfDeath: "x", notes: null } });
    const plan = planPlotBackfill(plot({ graves: [holder, real] }));
    expect(plan.graveCreates).toEqual([]);
    const upd = plan.graveUpdates.find((u) => u.id === 2);
    expect(upd.data.deathDate.getUTCFullYear()).toBe(2020);
    expect(upd.details.causeOfDeath).toBe("x");
    expect(upd.details.notes).toBe("n");
    expect(plan.graveDeletes).toEqual([1]);
  });

  it("keeps unparseable dates as note text rather than dropping them", () => {
    const holder = grave({ details: { notes: stackNotes([{ tier: 1, status: "occupied", deceasedName: "X Y", deathDate: "sometime in spring" }]) } });
    const plan = planPlotBackfill(plot({ graves: [holder] }));
    expect(plan.graveUpdates[0].data.deathDate).toBeNull();
    expect(plan.graveUpdates[0].details.notes).toContain("Died: sometime in spring");
  });
});

describe("planPlotBackfill — small legacy JSON", () => {
  it("normalizes a real grave's { text, birthDate, photo } blob", () => {
    const g = grave({ deceasedName: "Juan Cruz", tier: 1, details: { notes: JSON.stringify({ text: "remarks", birthDate: "1950-05-05", photo: "/p.jpg" }) } });
    const plan = planPlotBackfill(plot({ plotNumber: "A-001", graves: [g] }));
    expect(plan.graveUpdates[0].details.notes).toBe("remarks");
    expect(plan.graveUpdates[0].data.birthDate.getUTCFullYear()).toBe(1950);
    expect(plan.photos).toEqual([{ tier: 1, url: "/p.jpg" }]);
    expect(plan.graveDeletes).toEqual([]);
  });

  it("removes an empty 'Plot X' placeholder but keeps its photo plot-wide", () => {
    const g = grave({ deceasedName: "Plot A-001", details: { notes: JSON.stringify({ photo: "/p.jpg", text: "" }) } });
    const plan = planPlotBackfill(plot({ plotNumber: "A-001", graves: [g] }));
    expect(plan.graveDeletes).toEqual([1]);
    expect(plan.photos).toEqual([{ tier: 0, url: "/p.jpg" }]);
  });

  it("never deletes a placeholder-named record that holds real data", () => {
    const g = grave({ deceasedName: "Plot A-001", burialDate: new Date("2020-01-01"), details: { notes: JSON.stringify({ text: "t" }) } });
    const plan = planPlotBackfill(plot({ plotNumber: "A-001", graves: [g] }));
    expect(plan.graveDeletes).toEqual([]);
  });
});

describe("planPlotBackfill — idempotency", () => {
  it("returns an empty plan for already-normalized plots", () => {
    const g = grave({ deceasedName: "Juan Cruz", details: { notes: "plain remarks" } });
    const plan = planPlotBackfill(plot({ plotNumber: "A-001", totalTiers: 1, graves: [g] }));
    expect(plan.changed).toBe(false);
  });
  it("keeps a plot's tier count, never inventing one from its name", () => {
    expect(planPlotBackfill(plot({ graves: [] })).totalTiers).toBeNull(); // a "ROW-" name alone proves nothing
    expect(planPlotBackfill(plot({ totalTiers: 4, graves: [] })).changed).toBe(false);
  });

  it("raises the tier count to the highest tier that has a grave", () => {
    const g = grave({ id: 9, tier: 3, deceasedName: "Somebody", details: { notes: "plain" } });
    expect(planPlotBackfill(plot({ totalTiers: 1, graves: [g] })).totalTiers).toBe(3);
  });
});
