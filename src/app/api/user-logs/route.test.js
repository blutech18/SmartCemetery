import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userLog: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

const get = (qs = "") => GET(new Request(`http://localhost/api/user-logs${qs}`));

const row = (over = {}) => ({
  id: 1,
  action: "grave.create",
  ipAddress: "10.0.0.1",
  createdAt: new Date("2026-10-01T08:00:00Z"),
  user: { id: 5, name: "Admin A", email: "a@x.test", userType: { typeName: "Admin" } },
  ...over,
});

describe("GET /api/user-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ ok: true, user: { id: 1, role: "Admin" } });
    prisma.userLog.findMany.mockResolvedValue([row()]);
    prisma.userLog.count.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([{ category: "grave" }, { category: "auth" }, { category: "bad value;" }]);
  });

  it("is Admin-only: the guard's response is returned and nothing is read", async () => {
    requireRole.mockResolvedValueOnce({ ok: false, response: new Response("no", { status: 403 }) });
    expect((await get()).status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith(expect.anything(), "userLogs");
    expect(prisma.userLog.findMany).not.toHaveBeenCalled();
  });

  it("returns newest-first entries with the user flattened, pagination and categories", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs[0]).toMatchObject({ id: 1, action: "grave.create", user: { name: "Admin A", role: "Admin" } });
    expect(body.pagination).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    expect(body.categories).toEqual(["auth", "grave"]); // sorted, junk dropped
    expect(prisma.userLog.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("keeps entries with no user (e.g. an unknown account's failed sign-in)", async () => {
    prisma.userLog.findMany.mockResolvedValue([row({ id: 2, action: "auth.login_failed", user: null })]);
    const body = await (await get()).json();
    expect(body.logs[0].user).toBeNull();
  });

  it("clamps paging and applies category, user, date and text filters", async () => {
    await get("?page=0&limit=9999&category=grave&userId=5&from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&q=%20maria%20");
    const args = prisma.userLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(0);
    expect(args.where.userId).toBe(5);
    expect(args.where.action).toEqual({ startsWith: "grave." });
    expect(args.where.createdAt.gte).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(args.where.createdAt.lte).toEqual(new Date("2026-10-02T00:00:00Z"));
    expect(args.where.OR).toHaveLength(3);
    expect(args.where.OR[0]).toEqual({ action: { contains: "maria" } });
  });

  it("ignores unparseable dates and rejects an unsafe category", async () => {
    await get("?from=nonsense");
    expect(prisma.userLog.findMany.mock.calls[0][0].where.createdAt).toBeUndefined();
    const res = await get("?category=grave'%20OR%201=1");
    expect(res.status).toBe(400);
  });

  it("computes the page offset", async () => {
    prisma.userLog.count.mockResolvedValue(60);
    await get("?page=3&limit=20");
    expect(prisma.userLog.findMany.mock.calls[0][0].skip).toBe(40);
    const body = await (await get("?page=3&limit=20")).json();
    expect(body.pagination.totalPages).toBe(3);
  });
});
