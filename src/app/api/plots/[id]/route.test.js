import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    grave: { count: vi.fn() },
    plot: { update: vi.fn() },
  },
}));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  writeAuditLog: vi.fn(),
}));

import { PUT } from "./route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

const put = (body) =>
  PUT(
    new Request("http://localhost/api/plots/7", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "7" }) }
  );

describe("PUT /api/plots/:id — status rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ ok: true, user: { id: 1 } });
    prisma.plot.update.mockResolvedValue({ id: 7 });
  });

  it("lets a plot that holds records go under Maintenance", async () => {
    prisma.grave.count.mockResolvedValue(3);
    const res = await put({ status: "maintenance" });
    expect(res.status).toBe(200);
    expect(prisma.plot.update).toHaveBeenCalledTimes(1);
  });

  it("lets it go back to Occupied without checking records", async () => {
    const res = await put({ status: "occupied" });
    expect(res.status).toBe(200);
    expect(prisma.grave.count).not.toHaveBeenCalled();
  });

  it.each(["available", "reserved"])("refuses %s while the plot has records, and says why", async (status) => {
    prisma.grave.count.mockResolvedValue(2);
    const res = await put({ status });
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error).toMatch(/2 grave records/);
    expect(error).toMatch(new RegExp(`cannot be marked ${status}`));
    expect(error).toMatch(/Maintenance/);
    expect(prisma.plot.update).not.toHaveBeenCalled();
  });

  it("allows Available/Reserved when the plot is empty", async () => {
    prisma.grave.count.mockResolvedValue(0);
    expect((await put({ status: "available" })).status).toBe(200);
    expect((await put({ status: "reserved" })).status).toBe(200);
  });

  it("reports a duplicate plot number as its own, accurate conflict", async () => {
    prisma.plot.update.mockRejectedValue({ code: "P2002" });
    const res = await put({ plotNumber: "ROW-E01-C02" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already has that plot number/);
  });

  it("returns 404 for a missing plot and honours the authorization guard", async () => {
    prisma.plot.update.mockRejectedValue({ code: "P2025" });
    expect((await put({ plotNumber: "X" })).status).toBe(404);

    requireRole.mockResolvedValueOnce({ ok: false, response: new Response("no", { status: 403 }) });
    expect((await put({ status: "maintenance" })).status).toBe(403);
  });
});
