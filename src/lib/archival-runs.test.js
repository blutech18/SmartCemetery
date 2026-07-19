import { describe, expect, it, vi } from "vitest";
import { claimArchivalRun, defaultArchivalRunKey, isValidArchivalRunKey } from "@/lib/archival";

describe("archival run keys", () => {
  it("uses a stable UTC daily key and rejects unsafe headers", () => {
    expect(defaultArchivalRunKey(new Date("2026-07-20T23:59:59Z"))).toBe("daily:2026-07-20");
    expect(isValidArchivalRunKey("manual:2026-07-20.1")).toBe(true);
    expect(isValidArchivalRunKey("contains spaces")).toBe(false);
    expect(isValidArchivalRunKey("x".repeat(81))).toBe(false);
  });

  it("returns an existing successful run idempotently", async () => {
    const existing = { id: 3, runKey: "daily:2026-07-20", status: "success", archivedCount: 5 };
    const tx = { archivalRun: { findUnique: vi.fn().mockResolvedValue(existing) } };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const result = await claimArchivalRun(prisma, {
      runKey: existing.runKey,
      source: "cron",
      now: new Date(),
    });
    expect(result).toEqual({ state: "duplicate", run: existing });
  });

  it("refuses a different run while one is running", async () => {
    const running = { id: 8, runKey: "manual:one", status: "running" };
    const tx = {
      archivalRun: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(running),
      },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const result = await claimArchivalRun(prisma, {
      runKey: "manual:two", source: "admin", now: new Date(),
    });
    expect(result).toEqual({ state: "conflict", run: running });
  });
});
