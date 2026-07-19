import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.ENCRYPTION_KEY_VERSION = "v2";

vi.mock("@/lib/db", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
  writeAuditLog: vi.fn(),
}));

import { PATCH, DELETE } from "@/app/api/graves/[id]/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";

const context = (id = "3") => ({ params: Promise.resolve({ id }) });
const request = (method, body) => new Request("http://localhost/api/graves/3", {
  method,
  headers: { "content-type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
let tx;

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ ok: true, user: { id: 9, role: "Admin" } });
  tx = {
    grave: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    graveDetail: { upsert: vi.fn() },
    plot: { updateMany: vi.fn(), findUnique: vi.fn() },
  };
  prisma.$transaction.mockImplementation((callback) => callback(tx));
});

describe("grave Admin mutation routes", () => {
  it("denies mutation before entering a transaction", async () => {
    const denied = NextResponse.json({ error: "denied" }, { status: 403 });
    requireRole.mockResolvedValue({ ok: false, response: denied });
    expect((await PATCH(request("PATCH", { deceasedName: "A" }), context())).status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("moves plots with compare-and-set and stores all detail metadata encrypted", async () => {
    tx.grave.findUnique
      .mockResolvedValueOnce({ id: 3, plotId: 10, status: "active", details: null })
      .mockResolvedValueOnce({ id: 3, plotId: 11, details: null });
    tx.plot.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(request("PATCH", {
      plotId: 11,
      burialDate: "2024-02-01",
      contactPerson: "Jane Contact",
      notes: "private note",
    }), context());

    expect(response.status).toBe(200);
    expect(tx.plot.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.plot.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 11, status: "available", graves: { none: {} } },
      data: { status: "occupied" },
    });
    expect(tx.plot.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 10, status: "occupied", graves: { none: {} } },
      data: { status: "available" },
    });
    expect(tx.grave.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plotId: 11, verificationStatus: "pending" }),
    }));
    const stored = tx.graveDetail.upsert.mock.calls[0][0].create;
    expect(stored.contactPerson).not.toBe("Jane Contact");
    expect(decrypt(stored.contactPerson, "v2")).toBe("Jane Contact");
    expect(stored.notesEncrypted).toBe(true);
    expect(stored.encryptionKeyVersion).toBe("v2");
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "grave.update" }));
  });

  it("rolls back the update path when target plot cannot be claimed", async () => {
    tx.grave.findUnique.mockResolvedValue({ id: 3, plotId: 10, status: "active", details: null });
    tx.plot.updateMany.mockResolvedValue({ count: 0 });
    tx.plot.findUnique.mockResolvedValue({ status: "occupied" });
    const response = await PATCH(request("PATCH", { plotId: 11 }), context());
    expect(response.status).toBe(409);
    expect(tx.grave.update).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
  it("never deletes archived or retention-eligible graves", async () => {
    tx.grave.findUnique.mockResolvedValueOnce({
      id: 3, plotId: 10, status: "archived", burialDate: new Date("2000-01-01"),
    });
    let response = await DELETE(request("DELETE"), context());
    expect(response.status).toBe(409);
    expect(tx.grave.delete).not.toHaveBeenCalled();

    tx.grave.findUnique.mockResolvedValueOnce({
      id: 3, plotId: 10, status: "active", burialDate: new Date("2000-01-01"),
    });
    response = await DELETE(request("DELETE"), context());
    expect(response.status).toBe(409);
    expect(tx.grave.delete).not.toHaveBeenCalled();
    expect(tx.plot.updateMany).not.toHaveBeenCalled();
  });

  it("deletes an eligible grave, releases its plot with CAS, and audits", async () => {
    tx.grave.findUnique.mockResolvedValue({
      id: 3, plotId: 10, status: "active", burialDate: new Date(),
    });
    tx.plot.updateMany.mockResolvedValue({ count: 1 });
    const response = await DELETE(request("DELETE"), context());
    expect(response.status).toBe(200);
    expect(tx.grave.delete).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(tx.plot.updateMany).toHaveBeenCalledWith({
      where: { id: 10, status: "occupied", graves: { none: {} } },
      data: { status: "available" },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "grave.delete" }));
  });
});