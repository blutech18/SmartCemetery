import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userLog: { findMany: vi.fn() },
    navigation: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));

import { GET } from "@/app/api/analytics/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/analytics", () => {
  it("is Admin-only", async () => {
    const forbidden = new Response("forbidden", { status: 403 });
    requireRole.mockResolvedValue({ ok: false, response: forbidden });
    const response = await GET(new Request("http://localhost/api/analytics"));
    expect(response).toBe(forbidden);
    expect(prisma.navigation.findMany).not.toHaveBeenCalled();
  });

  it("queries only aggregate-safe fields and returns no names, IPs, or coordinates", async () => {
    requireRole.mockResolvedValue({ ok: true, user: { id: "1", role: "Admin" } });
    prisma.userLog.findMany.mockResolvedValue([{ action: "request.create", createdAt: new Date("2026-07-01") }]);
    prisma.navigation.findMany.mockResolvedValue([{ createdAt: new Date("2026-07-01"), channel: "dashboard", plotId: 5 }]);
    const response = await GET(new Request("http://localhost/api/analytics?from=2026-07-01&to=2026-07-31"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(prisma.navigation.findMany.mock.calls[0][0].select).toEqual({ createdAt: true, channel: true, plotId: true });
    expect(prisma.userLog.findMany.mock.calls[0][0].select).toEqual({ action: true, createdAt: true });
    expect(JSON.stringify(body)).not.toMatch(/ipAddress|origin|userName|name/);
  });
});
