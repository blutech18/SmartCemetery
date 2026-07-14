import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mock collaborators so no DB / JWT / SMTP is required ---
vi.mock("@/lib/db", () => ({
  prisma: {
    request: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

// Minimal mocks so the route module loads (unused for GET ?ref lookup).
vi.mock("@/lib/requests", () => ({
  REQUEST_SCHEMA: {},
  createUniqueReferenceId: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({
  createOutcomeNotification: vi.fn(),
  isEmailConfigured: vi.fn(() => false),
  sendOutcomeEmail: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
  getClientIp: vi.fn(() => ""),
}));

import { GET } from "@/app/api/requests/route";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";

/** Helper: build a GET request to /api/requests with a `ref` query param. */
function refRequest(ref) {
  return new Request(
    `http://localhost/api/requests?ref=${encodeURIComponent(ref)}`
  );
}

const AUTHED = { ok: true, user: { id: "1", role: "Client" } };

describe("GET /api/requests?ref= reference lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Req 7.5 — a found reference returns the current status and referenceId.
  it("returns 200 with current status and referenceId when found", async () => {
    requireAuth.mockResolvedValue(AUTHED);

    const record = {
      id: 42,
      referenceId: "REQ-XYZ",
      type: "correction",
      status: "approved",
      createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2026-01-02T00:00:00Z").toISOString(),
    };
    prisma.request.findFirst.mockResolvedValue(record);

    const response = await GET(refRequest("REQ-XYZ"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.referenceId).toBe("REQ-XYZ");
    expect(body.status).toBe("approved");
    expect(prisma.request.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referenceId: "REQ-XYZ", userId: 1 } })
    );
  });

  // Req 7.6 — an unknown reference returns 404 with an explanatory error.
  it("returns 404 with a no-match error when the reference is not found", async () => {
    requireAuth.mockResolvedValue(AUTHED);
    prisma.request.findFirst.mockResolvedValue(null);

    const response = await GET(refRequest("REQ-MISSING"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(String(body.error)).toMatch(/no request found/i);
    expect(String(body.error)).toContain("REQ-MISSING");
  });

  // Reference lookup requires authentication; the guard's 401 short-circuits.
  it("returns the auth 401 response and never queries when unauthenticated", async () => {
    const unauthorized = Response.json(
      { error: { type: "unauthorized", message: "Authentication required" } },
      { status: 401 }
    );
    requireAuth.mockResolvedValue({ ok: false, response: unauthorized });

    const response = await GET(refRequest("REQ-XYZ"));

    expect(response.status).toBe(401);
    expect(prisma.request.findFirst).not.toHaveBeenCalled();
  });
});
