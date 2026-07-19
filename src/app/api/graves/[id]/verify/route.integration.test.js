import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
  writeAuditLog: vi.fn(),
}));

import { PATCH } from "@/app/api/graves/[id]/verify/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";

const context = { params: Promise.resolve({ id: "4" }) };
const request = (body) => new Request("http://localhost/api/graves/4/verify", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
let tx;

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ ok: true, user: { id: 8, role: "Staff" } });
  tx = { grave: { findUnique: vi.fn(), update: vi.fn() } };
  prisma.$transaction.mockImplementation((callback) => callback(tx));
});

describe("grave verification route", () => {
  it("honors Staff/Admin authorization before reading", async () => {
    const denied = NextResponse.json({ error: "denied" }, { status: 403 });
    requireRole.mockResolvedValue({ ok: false, response: denied });
    const response = await PATCH(request({ status: "verified" }), context);
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("atomically refuses verified status while burial date or plot GPS is missing", async () => {
    tx.grave.findUnique.mockResolvedValue({
      id: 4,
      deceasedName: "Jane",
      burialDate: null,
      plotId: 2,
      plot: { id: 2, plotNumber: "A-2", gpsLat: 8.4, gpsLng: null },
    });
    const response = await PATCH(request({ status: "verified" }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).missing).toEqual(["burialDate", "plotGps"]);
    expect(tx.grave.update).not.toHaveBeenCalled();
  });

  it("records an atomic verified decision with verifier, time, note, and audit", async () => {
    tx.grave.findUnique.mockResolvedValue({
      id: 4,
      deceasedName: "Jane",
      burialDate: new Date("2024-01-01"),
      plotId: 2,
      plot: { id: 2, plotNumber: "A-2", gpsLat: 8.4, gpsLng: 124.6 },
    });
    tx.grave.update.mockResolvedValue({ id: 4, verificationStatus: "verified" });

    const response = await PATCH(request({ status: "verified", note: "Checked marker" }), context);
    expect(response.status).toBe(200);
    expect(tx.grave.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 4 },
      data: {
        verificationStatus: "verified",
        verifiedById: 8,
        verifiedAt: expect.any(Date),
        verificationNote: "Checked marker",
      },
    }));
    expect(writeAuditLog).toHaveBeenCalledWith({
      userId: 8,
      action: "grave.verify",
      ipAddress: "1.2.3.4",
    });
  });

  it.each(["rejected", "pending"])("records %s review status", async (status) => {
    tx.grave.findUnique.mockResolvedValue({
      id: 4,
      deceasedName: "Jane",
      burialDate: null,
      plotId: 2,
      plot: { id: 2, plotNumber: "A-2", gpsLat: null, gpsLng: null },
    });
    tx.grave.update.mockResolvedValue({ id: 4, verificationStatus: status });
    const response = await PATCH(request({ status, note: "Needs correction" }), context);
    expect(response.status).toBe(200);
    expect(tx.grave.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ verificationStatus: status, verifiedById: 8 }),
    }));
  });
});