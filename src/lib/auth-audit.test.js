import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() }, userLog: { create: vi.fn() } },
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((configuration) => configuration),
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({
  boundedRateLimit: vi.fn((name, fallback) => fallback),
  consumeRateLimit: vi.fn(),
  clearRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";

const provider = authOptions.providers[0];
const request = { headers: { "x-forwarded-for": "10.1.2.3" } };
const login = (email = "Staff@Example.test", password = "pw") => provider.authorize({ email, password }, request);
const logged = () => prisma.userLog.create.mock.calls.map((c) => c[0].data);

describe("sign-in auditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeRateLimit.mockResolvedValue({ allowed: true, key: "k", retryAfterSeconds: 1 });
    prisma.userLog.create.mockResolvedValue({});
  });

  it("records a successful sign-in against the account, with its IP", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7, name: "S", email: "staff@example.test", status: "active", passwordHash: "h", userType: { typeName: "Staff" },
    });
    bcrypt.compare.mockResolvedValue(true);
    const user = await login();
    expect(user).toMatchObject({ id: "7", role: "Staff" });
    expect(logged()).toEqual([{ userId: 7, action: "auth.login", ipAddress: "10.1.2.3" }]);
  });

  it("records a wrong password against the real account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7, status: "active", passwordHash: "h", userType: { typeName: "Staff" },
    });
    bcrypt.compare.mockResolvedValue(false);
    await expect(login()).rejects.toThrow(/Invalid email or password/);
    expect(logged()).toEqual([{ userId: 7, action: "auth.login_failed", ipAddress: "10.1.2.3" }]);
  });

  it("records an unknown account with no user — and never stores the typed email", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(login("typo-or-password@x.test")).rejects.toThrow(/Invalid email or password/);
    expect(logged()).toEqual([{ userId: null, action: "auth.login_failed", ipAddress: "10.1.2.3" }]);
    expect(JSON.stringify(logged())).not.toContain("typo-or-password");
  });

  it("records a disabled account's attempt against that account", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 9, status: "disabled", userType: { typeName: "Staff" } });
    await expect(login()).rejects.toThrow(/Invalid email or password/);
    expect(logged()).toEqual([{ userId: 9, action: "auth.login_failed", ipAddress: "10.1.2.3" }]);
  });

  it("records a throttled attempt as blocked", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, key: "k", retryAfterSeconds: 120 });
    await expect(login()).rejects.toThrow(/Too many login attempts/);
    expect(logged()).toEqual([{ userId: null, action: "auth.login_blocked", ipAddress: "10.1.2.3" }]);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("still signs the user in when the audit write itself fails", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7, name: "S", email: "s@x.test", status: "active", passwordHash: "h", userType: { typeName: "Staff" },
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.userLog.create.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(login()).resolves.toMatchObject({ id: "7" });
    spy.mockRestore();
  });
});

describe("sign-out auditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.userLog.create.mockResolvedValue({});
  });

  it("records a sign-out for the token's account", async () => {
    await authOptions.events.signOut({ token: { id: "7" } });
    expect(logged()).toEqual([{ userId: 7, action: "auth.logout", ipAddress: null }]);
  });

  it("does nothing when there is no signed-in account", async () => {
    await authOptions.events.signOut({ token: null });
    expect(prisma.userLog.create).not.toHaveBeenCalled();
  });
});
