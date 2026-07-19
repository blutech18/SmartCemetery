import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";

describe("authoritative account-state authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a valid signed token after its account is disabled", async () => {
    getToken.mockResolvedValue({ id: "5", role: "Admin" });
    prisma.user.findUnique.mockResolvedValue({
      status: "disabled",
      userType: { typeName: "Admin" },
    });
    const result = await requireAuth(new Request("http://localhost/api/test"));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
  });

  it("uses the current database role rather than a stale JWT role", async () => {
    getToken.mockResolvedValue({ id: "5", role: "Admin" });
    prisma.user.findUnique.mockResolvedValue({
      status: "active",
      userType: { typeName: "Staff" },
    });
    const result = await requireAuth(new Request("http://localhost/api/test"));
    expect(result).toEqual({ ok: true, user: { id: 5, role: "Staff" } });
  });
});