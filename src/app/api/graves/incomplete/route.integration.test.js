import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocked collaborators -------------------------------------------------
// The data layer is mocked so tests control exactly which grave rows the
// endpoint sees. Authorization is mocked so we can toggle allowed/denied.
// `validateRecordCompleteness` is intentionally left REAL (see import below)
// so the complete/incomplete partitioning is exercised genuinely.
vi.mock("@/lib/db", () => ({
  prisma: { grave: { findMany: vi.fn() } },
}));

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(),
}));

import { GET } from "@/app/api/graves/incomplete/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

// Minimal fake Request — the handler only forwards it to requireRole, which is
// mocked, so its concrete shape is irrelevant.
function fakeRequest() {
  return { url: "http://localhost/api/graves/incomplete", headers: new Map() };
}

// requireRole returns { ok: true } to allow, or { ok: false, response } to deny.
function allow() {
  requireRole.mockResolvedValue({ ok: true });
}

const pinnedPlot = (plotNumber = "A-1") => ({
  plotNumber,
  gpsLat: 8.45,
  gpsLng: 124.66,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/graves/incomplete (integration)", () => {
  it("returns only incomplete records with canonical missing fields (Req 5.2, 5.3, 5.4)", async () => {
    allow();

    // A mix of complete and incomplete active graves.
    const graves = [
      // Complete — must be excluded (Req 5.4).
      { id: "g-complete", deceasedName: "Jane Doe", burialDate: new Date("2020-01-01"), plotId: "p1", plot: pinnedPlot() },
      // Missing burialDate + plotId (and therefore plot GPS).
      { id: "g-1", deceasedName: "John Smith", burialDate: null, plotId: null, plot: null },
      // Missing deceasedName (whitespace only) — treated as missing.
      { id: "g-2", deceasedName: "   ", burialDate: new Date("2021-05-05"), plotId: "p2", plot: pinnedPlot("A-2") },
      // Missing plotId and plot GPS.
      { id: "g-3", deceasedName: "Alice", burialDate: new Date("2019-03-03"), plotId: null, plot: null },
      // Assigned plot missing one GPS coordinate.
      { id: "g-4", deceasedName: "Carol", burialDate: new Date("2022-06-06"), plotId: "p4", plot: { plotNumber: "A-4", gpsLat: 8.45, gpsLng: null } },
      // Another complete record — excluded.
      { id: "g-complete-2", deceasedName: "Bob", burialDate: new Date("2018-02-02"), plotId: "p3", plot: pinnedPlot("A-3") },
    ];
    prisma.grave.findMany.mockResolvedValue(graves);

    const response = await GET(fakeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);

    // Exactly the four incomplete records are returned.
    expect(body.count).toBe(4);
    expect(body.records).toHaveLength(4);

    const ids = body.records.map((r) => r.id).sort();
    expect(ids).toEqual(["g-1", "g-2", "g-3", "g-4"]);

    // No complete record leaked through.
    expect(ids).not.toContain("g-complete");
    expect(ids).not.toContain("g-complete-2");

    // Each incomplete record annotates the canonical missing field names.
    const byId = Object.fromEntries(body.records.map((r) => [r.id, r]));
    expect(byId["g-1"].missing.sort()).toEqual(["burialDate", "plotGps", "plotId"]);
    expect(byId["g-2"].missing).toEqual(["deceasedName"]);
    expect(byId["g-3"].missing.sort()).toEqual(["plotGps", "plotId"]);
    expect(byId["g-4"].missing).toEqual(["plotGps"]);

    // count matches the number of returned records.
    expect(body.count).toBe(body.records.length);
  });

  it("returns an empty list with a no-incomplete-records message when all complete (Req 5.5)", async () => {
    allow();
    prisma.grave.findMany.mockResolvedValue([
      { id: "g-a", deceasedName: "Jane", burialDate: new Date("2020-01-01"), plotId: "p1", plot: pinnedPlot() },
      { id: "g-b", deceasedName: "Bob", burialDate: new Date("2018-02-02"), plotId: "p3", plot: pinnedPlot("B-3") },
    ]);

    const response = await GET(fakeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ records: [], count: 0, message: "No incomplete records" });
  });

  it("returns the same empty-list message when there are no graves at all (Req 5.5)", async () => {
    allow();
    prisma.grave.findMany.mockResolvedValue([]);

    const response = await GET(fakeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ records: [], count: 0, message: "No incomplete records" });
  });

  it("returns 500 with an error and no partial/stale list on data-source failure (Req 5.6)", async () => {
    allow();
    prisma.grave.findMany.mockRejectedValue(new Error("db unavailable"));

    const response = await GET(fakeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    // Error shape is present...
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe("data_source");
    // ...and no partial/stale record list is exposed.
    expect(body.records).toBeUndefined();
    expect(body.count).toBeUndefined();
  });

  it("returns the authz denial response and never queries the data source when unauthorized", async () => {
    const deniedResponse = { __denied: true };
    requireRole.mockResolvedValue({ ok: false, response: deniedResponse });

    const response = await GET(fakeRequest());

    expect(response).toBe(deniedResponse);
    expect(prisma.grave.findMany).not.toHaveBeenCalled();
  });
});
