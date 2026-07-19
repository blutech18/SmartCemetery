import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Test framing (spec task 19.5; design.md §11; Req 12.1, 12.3, 12.5) ---
// These are ENDPOINT-level integration tests for the navigation log route.
//
// Scope note: The route persists a navigation event on a valid POST. The
// CLIENT overlay (NavigationOverlay.js) is responsible for only calling POST
// after a successful route calculation — that pure gating logic is covered by
// the navigation.js property tests (tasks 19.2/19.3), NOT here. Here we verify
// the API contract:
//   - persists when a destination is present (Req 12.3),
//   - rejects (400) with no log when destination is absent (mirrors "no
//     route/log when destination missing", Req 12.4-ish at the API layer),
//   - returns 500 without partial persistence when the DB fails (Req 12.5),
//   - lists navigation logs on GET.
//
// The data layer (@/lib/db) is mocked so tests control persistence behavior
// (success, failure) without a real database.
vi.mock("@/lib/db", () => ({
  prisma: { navigation: { create: vi.fn(), findMany: vi.fn() } },
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import { POST, GET } from "@/app/api/navigation/route";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/authz";

// Build a real Request so the handler's `await request.json()` parses a real
// JSON body.
function postRequest(body) {
  return new Request("http://localhost/api/navigation", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getRequest(url = "http://localhost/api/navigation") {
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({
    ok: true,
    user: { id: "7", role: "Client" },
  });
  requireRole.mockResolvedValue({
    ok: true,
    user: { id: "1", role: "Admin" },
  });
});

describe("POST /api/navigation (integration)", () => {
  // Req 12.3 — a valid navigation event is logged/persisted. Timestamp fields
  // (createdAt) are DB-side, so we only assert origin + destination in the
  // create payload.
  it("logs the navigation event and returns 201 on success (Req 12.3)", async () => {
    const persisted = {
      id: 1,
      userId: 7,
      origin: "1,2",
      destination: "3,4",
      createdAt: new Date().toISOString(),
    };
    prisma.navigation.create.mockResolvedValue(persisted);

    const response = await POST(postRequest({ origin: "1,2", destination: "3,4" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, id: 1 });

    expect(prisma.navigation.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.navigation.create.mock.calls[0][0];
    expect(createArg).toEqual({
      data: {
        userId: 7,
        origin: "1,2",
        destination: "3,4",
        plotId: null,
        channel: "dashboard",
        distanceMeters: null,
        durationSeconds: null,
      },
      select: { id: true },
    });
  });

  // Req 12.4-ish at the API layer — destination is required. A request with no
  // destination is rejected with 400 and NOTHING is persisted (no partial log).
  it("rejects a missing destination with 400 and never persists (no log)", async () => {
    const response = await POST(postRequest({ origin: "1,2" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(prisma.navigation.create).not.toHaveBeenCalled();
  });

  // Req 12.5 — when persistence fails, the endpoint returns 500 and does not
  // return a partial/confirmed log record.
  it("returns 500 and no partial log when persistence fails (Req 12.5)", async () => {
    prisma.navigation.create.mockRejectedValue(new Error("db unavailable"));

    const response = await POST(postRequest({ origin: "1,2", destination: "3,4" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
    // No confirmation id / partial record leaked on failure.
    expect(body.id).toBeUndefined();
  });
});

describe("GET /api/navigation (privacy)", () => {
  it("does not expose raw user-linked navigation logs", async () => {
    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(body.error.type).toBe("not_supported");
    expect(prisma.navigation.findMany).not.toHaveBeenCalled();
  });
});


describe("POST /api/navigation extended metrics", () => {
  it("validates and persists plot, channel, distance, and duration without echoing raw coordinates", async () => {
    prisma.navigation.create.mockResolvedValue({ id: 12 });
    const response = await POST(postRequest({
      origin: "private-origin",
      destination: "private-destination",
      plotId: 9,
      channel: "kiosk",
      distanceMeters: 450,
      durationSeconds: 320,
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, id: 12 });
    expect(JSON.stringify(body)).not.toContain("private-origin");
    expect(prisma.navigation.create.mock.calls[0][0].data).toMatchObject({
      plotId: 9, channel: "kiosk", distanceMeters: 450, durationSeconds: 320,
    });
  });

  it("rejects invalid negative metrics", async () => {
    const response = await POST(postRequest({ destination: "3,4", distanceMeters: -1 }));
    expect(response.status).toBe(400);
    expect(prisma.navigation.create).not.toHaveBeenCalled();
  });
});
