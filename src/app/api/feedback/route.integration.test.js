import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocked collaborators -------------------------------------------------
// The data layer is mocked so tests control persistence behavior (success,
// failure) without a database. Authorization is mocked so we can toggle
// authenticated/unauthenticated per test and control the session user id.
// `@/lib/validation` is intentionally left REAL (not mocked) so the genuine
// rating/comment validation runs against the endpoint's schema.
vi.mock("@/lib/db", () => ({
  prisma: { feedback: { create: vi.fn(), findMany: vi.fn() } },
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import { POST } from "@/app/api/feedback/route";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";

// Build a real Request so the handler's `await request.json()` parses a real
// JSON body — this exercises the genuine validation path.
function postRequest(body) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// requireAuth returns { ok: true, user } when authenticated, or
// { ok: false, response } to reject with a 401.
function authAs(user) {
  requireAuth.mockResolvedValue({ ok: true, user });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/feedback (integration)", () => {
  // Req 8.5 — feedback submission requires an authenticated user; an
  // unauthenticated request is rejected before any record is created.
  it("rejects unauthenticated submissions with 401 and never persists (Req 8.5)", async () => {
    const unauthorized = new Response(
      JSON.stringify({ error: { type: "auth", message: "Authentication required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
    requireAuth.mockResolvedValue({ ok: false, response: unauthorized });

    const response = await POST(postRequest({ rating: 5, comment: "great" }));

    expect(response.status).toBe(401);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  // Req 8.6 — a successful submission returns a confirmation that includes the
  // persisted feedback id, and the userId is taken from the session (not body).
  it("returns 201 with the persisted feedback id and uses the session userId (Req 8.6)", async () => {
    authAs({ id: "7", role: "Client" });

    const persisted = {
      id: 123,
      userId: 7,
      rating: 5,
      comment: "great",
      user: { id: 7, name: "Alice" },
    };
    prisma.feedback.create.mockResolvedValue(persisted);

    // Include a bogus userId in the body to prove it is ignored in favor of the
    // session identity.
    const response = await POST(postRequest({ rating: 5, comment: "great", userId: 999 }));
    const body = await response.json();

    expect(response.status).toBe(201);
    // Confirmation includes the persisted feedback id.
    expect(body.id).toBe(123);

    // create was called exactly once with the userId derived from the session
    // (Number("7") === 7), not the value supplied in the request body.
    expect(prisma.feedback.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.feedback.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe(7);
    expect(createArg.data.userId).not.toBe(999);
    expect(createArg.data.rating).toBe(5);
    expect(createArg.data.comment).toBe("great");
  });

  // Req 8.7 — when persistence fails, the endpoint returns a 500 error and does
  // not return a partial/confirmed record.
  it("returns 500 and no partial record when persistence fails (Req 8.7)", async () => {
    authAs({ id: "7", role: "Client" });
    prisma.feedback.create.mockRejectedValue(new Error("db unavailable"));

    const response = await POST(postRequest({ rating: 4, comment: "ok" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
    // No confirmation id / partial record leaked on failure.
    expect(body.id).toBeUndefined();
  });

  // Validation edge — an out-of-range rating yields the uniform 400 validation
  // error and never reaches persistence.
  it("returns a uniform 400 validation error for an out-of-range rating and never persists", async () => {
    authAs({ id: "7", role: "Client" });

    const response = await POST(postRequest({ rating: 6, comment: "too high" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.type).toBe("validation");
    expect(body.error.fields.some((f) => f.field === "rating")).toBe(true);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("returns a uniform 400 validation error for a non-integer rating and never persists", async () => {
    authAs({ id: "7", role: "Client" });

    const response = await POST(postRequest({ rating: 3.5 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.type).toBe("validation");
    expect(body.error.fields.some((f) => f.field === "rating")).toBe(true);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });
});
