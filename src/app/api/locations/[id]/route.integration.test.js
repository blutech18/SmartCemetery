import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: { location: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
  writeAuditLog: vi.fn(),
}));

import { GET } from "@/app/api/locations/route";
import { PATCH } from "@/app/api/locations/[id]/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";

const admin = { ok: true, user: { id: 7, role: "Admin" } };
const context = (id = "2") => ({ params: Promise.resolve({ id }) });
const patchRequest = (body) => new Request("http://localhost/api/locations/2", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(admin);
  prisma.location.update.mockResolvedValue({ id: 2, name: "North", isActive: true, details: [] });
});

describe("location lifecycle routes", () => {
  it("hides inactive locations from public GET by default", async () => {
    prisma.location.findMany.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/locations"));
    expect(response.status).toBe(200);
    expect(prisma.location.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    expect(requireRole).not.toHaveBeenCalled();
  });
  it("requires Admin when inactive locations are requested", async () => {
    const denied = NextResponse.json({ error: "forbidden" }, { status: 403 });
    requireRole.mockResolvedValue({ ok: false, response: denied });
    const response = await GET(new Request("http://localhost/api/locations?includeInactive=true"));
    expect(response.status).toBe(403);
    expect(prisma.location.findMany).not.toHaveBeenCalled();
  });

  it("updates fields without touching child records and audits", async () => {
    const response = await PATCH(patchRequest({ name: " North ", description: null }), context());
    expect(response.status).toBe(200);
    expect(prisma.location.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 2 },
      data: { name: "North", description: null },
    }));
    expect(writeAuditLog).toHaveBeenCalledWith({
      userId: 7,
      action: "location.update",
      ipAddress: "1.2.3.4",
    });
  });

  it("deactivates and reactivates without deleting children", async () => {
    await PATCH(patchRequest({ isActive: false }), context());
    expect(prisma.location.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isActive: false,
        deactivatedAt: expect.any(Date),
        deactivatedById: 7,
      }),
    }));
    expect(writeAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: "location.deactivate" }));

    await PATCH(patchRequest({ isActive: true }), context());
    expect(prisma.location.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isActive: true, deactivatedAt: null, deactivatedById: null }),
    }));
    expect(writeAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: "location.reactivate" }));
  });

  it("rejects invalid coordinates before mutation", async () => {
    const response = await PATCH(patchRequest({ gpsLat: 100 }), context());
    expect(response.status).toBe(400);
    expect(prisma.location.update).not.toHaveBeenCalled();
  });
});