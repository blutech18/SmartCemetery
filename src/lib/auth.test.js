import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((configuration) => configuration),
}));

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

describe("JWT account-state refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks a disabled account so proxy and API guards revoke access", async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: "disabled",
      userType: { typeName: "Staff" },
    });
    const token = await authOptions.callbacks.jwt({
      token: { id: "12", role: "Staff" },
      user: null,
    });
    expect(token.disabled).toBe(true);
  });

  it("refreshes the active account role from the database", async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: "active",
      userType: { typeName: "Admin" },
    });
    const token = await authOptions.callbacks.jwt({
      token: { id: "12", role: "Staff", disabled: true },
      user: null,
    });
    expect(token).toMatchObject({ role: "Admin", disabled: false });
  });
});