import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { archivalRun: { findMany: vi.fn() } },
}));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/archival", () => ({
  archiveOldRecords: vi.fn(),
  claimArchivalRun: vi.fn(),
  completeArchivalRun: vi.fn(),
  defaultArchivalRunKey: vi.fn(() => "daily:2026-07-20"),
  failArchivalRun: vi.fn(),
  isValidArchivalRunKey: vi.fn(() => true),
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(), getClientIp: vi.fn(() => "") }));

import { GET, POST } from "@/app/api/archival/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  archiveOldRecords,
  claimArchivalRun,
  completeArchivalRun,
  failArchivalRun,
} from "@/lib/archival";

function request(method = "POST", headers = {}) {
  return new Request("http://localhost/api/archival", { method, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ ok: true, user: { id: "1", role: "Admin" } });
});

describe("POST /api/archival durable runs", () => {
  it("claims, completes, and returns a new run", async () => {
    claimArchivalRun.mockResolvedValue({ state: "claimed", run: { id: 4, runKey: "daily:2026-07-20" } });
    archiveOldRecords.mockResolvedValue({ archivedCount: 3 });
    completeArchivalRun.mockResolvedValue({ id: 4, runKey: "daily:2026-07-20", status: "success", archivedCount: 3 });

    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "success", archivedCount: 3, duplicate: false });
    expect(completeArchivalRun).toHaveBeenCalledWith(expect.anything(), 4, 3);
  });

  it("returns a prior successful duplicate without archiving again", async () => {
    claimArchivalRun.mockResolvedValue({ state: "duplicate", run: { id: 4, status: "success", archivedCount: 3 } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true, status: "success" });
    expect(archiveOldRecords).not.toHaveBeenCalled();
  });

  it("returns 409 for an overlapping run", async () => {
    claimArchivalRun.mockResolvedValue({ state: "conflict", run: { id: 8, runKey: "other", status: "running" } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(archiveOldRecords).not.toHaveBeenCalled();
  });

  it("persists failed status when archival throws", async () => {
    claimArchivalRun.mockResolvedValue({ state: "claimed", run: { id: 9 } });
    archiveOldRecords.mockRejectedValue(new Error("database unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(failArchivalRun).toHaveBeenCalledWith(expect.anything(), 9, expect.any(Error));
  });
});

describe("GET /api/archival", () => {
  it("returns recent runs for Admin", async () => {
    prisma.archivalRun.findMany.mockResolvedValue([{ id: 2, status: "success" }]);
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 2, status: "success" }]);
    expect(prisma.archivalRun.findMany).toHaveBeenCalledWith({ orderBy: { startedAt: "desc" }, take: 20 });
  });
});
