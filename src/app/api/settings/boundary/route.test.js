import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PUT, validateBoundaryOffsets } from "./route";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";

function makeRequest(method, body) {
  return new Request("http://localhost/api/settings/boundary", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("validateBoundaryOffsets", () => {
  it("accepts and normalizes valid offsets", () => {
    expect(validateBoundaryOffsets([{ dx: 1.234, dy: -2.345 }, { dx: 3, dy: 4 }, { dx: 5, dy: 6 }])).toEqual([
      { dx: 1.23, dy: -2.35 },
      { dx: 3, dy: 4 },
      { dx: 5, dy: 6 },
    ]);
  });

  it("rejects non-arrays, too few vertices, and non-finite values", () => {
    expect(validateBoundaryOffsets(null)).toBeNull();
    expect(validateBoundaryOffsets([{ dx: 1, dy: 2 }])).toBeNull();
    expect(validateBoundaryOffsets([{ dx: 1, dy: 2 }, { dx: 3, dy: 4 }, { dx: "x", dy: 6 }])).toBeNull();
    expect(validateBoundaryOffsets([{ dx: 1, dy: 2 }, { dx: 3, dy: 4 }, { dx: 5000, dy: 0 }])).toBeNull();
  });
});

describe("GET/PUT /api/settings/boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ ok: true, user: { id: 1, role: "Staff" } });
    requireRole.mockResolvedValue({ ok: true, user: { id: 1, role: "Admin" } });
  });

  it("returns the stored offsets, or null when unset", async () => {
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      key: "cmp_boundary_offsets",
      value: JSON.stringify([{ dx: 1, dy: 2 }, { dx: 3, dy: 4 }, { dx: 5, dy: 6 }]),
    });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    expect((await res.json()).offsets).toHaveLength(3);

    prisma.appSetting.findUnique.mockResolvedValueOnce(null);
    const res2 = await GET(makeRequest("GET"));
    expect((await res2.json()).offsets).toBeNull();
  });

  it("returns 401/403 from the guard without writing", async () => {
    requireRole.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: { type: "forbidden" } }), { status: 403 }),
    });
    const res = await PUT(makeRequest("PUT", { offsets: [{ dx: 1, dy: 2 }, { dx: 3, dy: 4 }, { dx: 5, dy: 6 }] }));
    expect(res.status).toBe(403);
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid offsets with 400 and no write", async () => {
    const res = await PUT(makeRequest("PUT", { offsets: [{ dx: 1, dy: 2 }] }));
    expect(res.status).toBe(400);
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("upserts valid offsets and writes an audit entry", async () => {
    prisma.appSetting.upsert.mockResolvedValue({});
    const offsets = [{ dx: 1, dy: 2 }, { dx: 3, dy: 4 }, { dx: 5, dy: 6 }];
    const res = await PUT(makeRequest("PUT", { offsets }));
    expect(res.status).toBe(200);
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "boundary.update", userId: 1 })
    );
  });
});
