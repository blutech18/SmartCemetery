import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    plot: {
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    navigation: {
      updateMany: vi.fn(),
    },
    locationDetail: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  writeAuditLog: vi.fn(),
}));

import { POST } from "./route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

function makeRequest(body) {
  return new Request("http://localhost/api/plots/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plots/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ ok: true, user: { id: 1 } });
    prisma.$transaction.mockImplementation((ops) => Promise.resolve(ops));
  });

  it("returns 400 when no plots and no deletePlotIds are provided", async () => {
    const res = await POST(makeRequest({ plots: [], deletePlotIds: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Expected an array of plots or deletePlotIds");
  });

  it("safely deletes empty excess plots without graves", async () => {
    // Plots 301 and 302 have NO graves
    prisma.plot.findMany.mockResolvedValue([]);
    prisma.navigation.updateMany.mockReturnValue({ count: 0 });
    prisma.plot.deleteMany.mockReturnValue({ count: 2 });
    prisma.plot.update.mockReturnValue({ id: 201, plotNumber: "ROW-E03-C01" });

    const res = await POST(
      makeRequest({
        plots: [{ id: 201, gpsLat: 8.465, gpsLng: 124.657 }],
        deletePlotIds: [301, 302],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deletedCount).toBe(2);
    expect(data.deletedIds).toEqual([301, 302]);
    expect(prisma.plot.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [301, 302] } },
    });
  });

  it("returns the authorization response and performs no writes when the caller lacks the layout role", async () => {
    // No development bypass: a failed guard must return the 403 response and
    // never fall back to acting as some Admin user.
    requireRole.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: { type: "forbidden", message: "Insufficient role permission" } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    });

    const res = await POST(makeRequest({ deletePlotIds: [1] }));

    expect(res.status).toBe(403);
    expect(prisma.plot.deleteMany).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("unpins plots with active graves instead of deleting them", async () => {
    // Plot 204 has a grave, Plot 203 does not
    prisma.plot.findMany.mockResolvedValue([{ id: 204, plotNumber: "ROW-E03-C04" }]);
    prisma.navigation.updateMany.mockReturnValue({ count: 0 });
    prisma.plot.deleteMany.mockReturnValue({ count: 1 });
    prisma.plot.updateMany.mockReturnValue({ count: 1 });

    const res = await POST(
      makeRequest({
        deletePlotIds: [203, 204],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deletedCount).toBe(1);
    expect(data.deletedIds).toEqual([203]);
    expect(data.unpinnedGravePlotIds).toEqual([204]);

    // Plot 203 deleted
    expect(prisma.plot.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [203] } },
    });
    // Plot 204 unpinned (gps coords set to null)
    expect(prisma.plot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [204] } },
      data: { gpsLat: null, gpsLng: null },
    });
  });

  describe("creating new plots", () => {
    beforeEach(() => {
      prisma.plot.upsert.mockImplementation((args) => ({ id: 900, ...args.create }));
    });

    it("uses an explicit section and stores the tier count", async () => {
      const res = await POST(
        makeRequest({ plots: [{ plotNumber: "X-C01", locationDetailId: 7, totalTiers: 4, gpsLat: 8.4, gpsLng: 124.6 }] })
      );
      expect(res.status).toBe(200);
      const { create } = prisma.plot.upsert.mock.calls[0][0];
      expect(create).toMatchObject({ plotNumber: "X-C01", locationDetailId: 7, totalTiers: 4 });
    });

    it("finds the section by the named building, whatever it is called", async () => {
      prisma.locationDetail.findMany.mockResolvedValue([{ id: 31, subsection: "Crypt Block 2" }]);
      await POST(
        makeRequest({ plots: [{ plotNumber: "Whatever-7", buildingKey: "crypt block 2", totalTiers: 3, gpsLat: 8.4, gpsLng: 124.6 }] })
      );
      expect(prisma.plot.upsert.mock.calls[0][0].create).toMatchObject({ locationDetailId: 31, totalTiers: 3 });
    });

    it("falls back to the plot number without its column suffix", async () => {
      prisma.locationDetail.findMany.mockResolvedValue([{ id: 44, subsection: "Wing A" }]);
      await POST(makeRequest({ plots: [{ plotNumber: "Wing A-C05", gpsLat: 8.4, gpsLng: 124.6 }] }));
      expect(prisma.plot.upsert.mock.calls[0][0].create.locationDetailId).toBe(44);
    });

    it("treats a missing or invalid tier count as an ordinary single-tier lot", async () => {
      for (const totalTiers of [undefined, 0, -3, 2.5, 99, "x"]) {
        prisma.plot.upsert.mockClear();
        await POST(makeRequest({ plots: [{ plotNumber: "L-1", locationDetailId: 7, totalTiers, gpsLat: 8.4, gpsLng: 124.6 }] }));
        expect(prisma.plot.upsert.mock.calls[0][0].create.totalTiers).toBe(1);
      }
    });

    it("skips, rather than guesses, when no section can be resolved", async () => {
      prisma.locationDetail.findMany.mockResolvedValue([{ id: 1, subsection: "Other" }]);
      const res = await POST(makeRequest({ plots: [{ plotNumber: "Nowhere-C01", gpsLat: 8.4, gpsLng: 124.6 }] }));
      expect(prisma.plot.upsert).not.toHaveBeenCalled();
      expect(res.status).toBe(400);
    });
  });
});
