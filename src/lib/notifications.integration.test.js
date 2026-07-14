/**
 * Integration tests for request-outcome notifications and email delivery.
 *
 * Covers spec task 13.3 of "complete-smart-cemetery-platform"
 * (design.md section 9; Requirements 9.1, 9.3, 9.4, 9.5).
 *
 * These are example/integration-style tests using a fake prisma client and an
 * injected email transport — no real database or SMTP server is contacted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOutcomeNotification,
  isEmailConfigured,
  sendOutcomeEmail,
  MAX_EMAIL_ATTEMPTS,
} from "@/lib/notifications.js";

// All SMTP env vars that isEmailConfigured() checks.
const SMTP_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];

/** Snapshot and restore process.env around each test so cases stay isolated. */
let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const name of SMTP_VARS) {
    savedEnv[name] = process.env[name];
    // Start each test from a clean, unconfigured baseline.
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of SMTP_VARS) {
    if (savedEnv[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = savedEnv[name];
    }
  }
  vi.restoreAllMocks();
});

/** Populate all SMTP vars so isEmailConfigured() returns true. */
function configureSmtpEnv() {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "mailer";
  process.env.SMTP_PASS = "secret";
  process.env.EMAIL_FROM = "no-reply@example.com";
}

/** Fake prisma client whose notification.create echoes the created row. */
function makeFakePrisma() {
  return {
    notification: {
      create: vi.fn(async ({ data }) => ({ id: 1, ...data })),
    },
  };
}

describe("createOutcomeNotification (Req 9.1)", () => {
  it("persists an in-app entry recording userId, requestId, referenceId, outcome and createdAt for an approval", async () => {
    const prisma = makeFakePrisma();
    const changedAt = new Date("2026-07-10T20:02:24.000Z");
    const request = { id: 42, userId: 7, referenceId: "REQ-2026-0042" };

    const row = await createOutcomeNotification({
      prisma,
      request,
      outcome: "approved",
      changedAt,
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        requestId: 42,
        referenceId: "REQ-2026-0042",
        outcome: "approved",
        emailStatus: "none",
        createdAt: changedAt,
      },
    });
    // The persisted row is returned to the caller.
    expect(row).toMatchObject({
      id: 1,
      userId: 7,
      requestId: 42,
      referenceId: "REQ-2026-0042",
      outcome: "approved",
      createdAt: changedAt,
    });
  });

  it("persists an in-app entry for a rejection", async () => {
    const prisma = makeFakePrisma();
    const changedAt = new Date("2026-07-11T09:00:00.000Z");
    const request = { id: 43, userId: 8, referenceId: "REQ-2026-0043" };

    const row = await createOutcomeNotification({
      prisma,
      request,
      outcome: "rejected",
      changedAt,
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.notification.create.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: 8,
      requestId: 43,
      referenceId: "REQ-2026-0043",
      outcome: "rejected",
      createdAt: changedAt,
    });
    expect(row.outcome).toBe("rejected");
  });

  it("throws on an invalid outcome and never touches prisma", async () => {
    const prisma = makeFakePrisma();
    const request = { id: 44, userId: 9, referenceId: "REQ-2026-0044" };

    await expect(
      createOutcomeNotification({ prisma, request, outcome: "maybe" })
    ).rejects.toThrow(/Invalid outcome/);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe("sendOutcomeEmail — single send when configured (Req 9.3)", () => {
  it("performs exactly one successful logical send and reports { sent: true, attempts: 1 }", async () => {
    configureSmtpEnv();
    expect(isEmailConfigured()).toBe(true);

    const transport = { send: vi.fn(async () => ({ ok: true })) };

    const result = await sendOutcomeEmail(
      "client@example.com",
      { referenceId: "REQ-2026-0042", outcome: "approved" },
      { transport }
    );

    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: true, attempts: 1 });

    // The single email describes the outcome and Reference ID (Req 9.3).
    const sendArgs = transport.send.mock.calls[0][0];
    expect(sendArgs.to).toBe("client@example.com");
    expect(sendArgs.subject).toContain("REQ-2026-0042");
    expect(sendArgs.subject).toContain("approved");
    expect(sendArgs.text).toContain("REQ-2026-0042");
  });
});

describe("sendOutcomeEmail — bounded retries on failure, in-app entry retained (Req 9.5)", () => {
  it("retries up to MAX_EMAIL_ATTEMPTS (3) times then reports failure without throwing", async () => {
    configureSmtpEnv();
    expect(MAX_EMAIL_ATTEMPTS).toBe(3);

    const transport = {
      send: vi.fn(async () => {
        throw new Error("smtp unavailable");
      }),
    };

    const result = await sendOutcomeEmail(
      "client@example.com",
      { referenceId: "REQ-2026-0042", outcome: "rejected" },
      { transport }
    );

    expect(transport.send).toHaveBeenCalledTimes(MAX_EMAIL_ATTEMPTS);
    expect(result.sent).toBe(false);
    expect(result.attempts).toBe(MAX_EMAIL_ATTEMPTS);
    expect(result.error).toBeTruthy();
    expect(String(result.error)).toContain("smtp unavailable");
  });

  it("keeps the in-app notification entry independent of a failed email delivery", async () => {
    configureSmtpEnv();
    const prisma = makeFakePrisma();
    const changedAt = new Date("2026-07-10T20:02:24.000Z");
    const request = { id: 42, userId: 7, referenceId: "REQ-2026-0042" };

    // The in-app entry is created independently of email delivery.
    const row = await createOutcomeNotification({
      prisma,
      request,
      outcome: "approved",
      changedAt,
    });

    // Email delivery fails outright.
    const transport = {
      send: vi.fn(async () => {
        throw new Error("smtp down");
      }),
    };
    const emailResult = await sendOutcomeEmail(
      "client@example.com",
      { referenceId: request.referenceId, outcome: "approved" },
      { transport }
    );

    // Failed email does not delete or alter the in-app entry — it is still the
    // created row, and prisma was only ever asked to create (never delete/update).
    expect(emailResult.sent).toBe(false);
    expect(row).toMatchObject({
      id: 1,
      userId: 7,
      requestId: 42,
      referenceId: "REQ-2026-0042",
      outcome: "approved",
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });
});

describe("sendOutcomeEmail — not configured -> in-app only, no error (Req 9.4)", () => {
  it("reports skipped without attempting a send and without throwing", async () => {
    // beforeEach already cleared all SMTP vars.
    expect(isEmailConfigured()).toBe(false);

    const transport = { send: vi.fn(async () => ({ ok: true })) };

    const result = await sendOutcomeEmail(
      "client@example.com",
      { referenceId: "REQ-2026-0042", outcome: "approved" },
      { transport }
    );

    expect(result).toEqual({ sent: false, attempts: 0, skipped: true });
    // No delivery is attempted when unconfigured.
    expect(transport.send).not.toHaveBeenCalled();
  });
});
