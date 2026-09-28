import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    location: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    locationDetail: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    plot: {
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    grave: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({
  encryptGraveDetail: vi.fn((detail) => ({ ...detail, encryptionKeyVersion: "v1" })),
}));

import { POST } from "./route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

function makeRequest() {
  return new Request("http://localhost/api/plots/preset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/plots/preset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ ok: true, user: { id: 1 } });
    prisma.location.findFirst.mockResolvedValue({ id: 4, name: "City Memorial Park (CMP) - Bolonsiri" });
    prisma.locationDetail.findFirst.mockImplementation(({ where }) =>
      Promise.resolve({ id: 100, subsection: where.subsection })
    );
    prisma.plot.upsert.mockResolvedValue({ id: 200, plotNumber: "TEST-01", graves: [] });
    prisma.plot.findMany.mockResolvedValue([]);
  });

  it("rejects unauthorized users", async () => {
    requireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("applies preset and returns 200 with plots", async () => {
    prisma.plot.findMany.mockResolvedValue([
      { id: 1, plotNumber: "ROW-E01-C01", gpsLat: 8.465, gpsLng: 124.656 },
    ]);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.totalPlots).toBe(119);
    expect(data.plots.length).toBe(1);
  });
});
