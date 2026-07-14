/**
 * Integration tests for GET /api/reports/stats — report breakdown timing.
 *
 * Covers spec task 15.4 of the "complete-smart-cemetery-platform" spec
 * (design.md section 10; Req 11.5). The route's collaborators are mocked at the
 * seams (`@/lib/db` Prisma client and `@/lib/authz` role guard) while the pure
 * `computeReport` model is kept REAL, so the breakdowns are genuinely computed
 * from the fake datasets and the elapsed-time assertion measures real work.
 *
 * Requirements exercised:
 *  - 11.5: the breakdown returns within the performance budget (< 3 seconds).
 *  - 11.1: request status breakdown (pending/approved/rejected).
 *  - 11.2: feedback distribution buckets 1–5.
 *  - 11.4: an empty period yields zero-valued groups, not an error.
 *  - Admin-only access (Req 10.4/11): a failed role guard is returned verbatim.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock collaborators at the seams ────────────────────────────
// Prisma is fully mocked; each read is a vi.fn we drive per-test.
vi.mock("@/lib/db", () => ({
  prisma: {
    grave: { findMany: vi.fn() },
    plot: { findMany: vi.fn() },
    request: { findMany: vi.fn() },
    feedback: { findMany: vi.fn() },
    location: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}));

// The role guard is mocked so we control auth outcomes without a JWT.
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));

import { GET } from "@/app/api/reports/stats/route.js";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

// ── Helpers ────────────────────────────────────────────────────

const PERFORMANCE_BUDGET_MS = 3000;
const REQUEST_URL =
  "http://localhost/api/reports/stats?from=2024-01-01&to=2024-12-31";

/**
 * All timestamps land safely inside the requested 2024 window. Built in UTC and
 * kept mid-year so they never straddle the from/to boundaries regardless of the
 * host timezone.
 */
const inPeriodDate = (i) =>
  new Date(Date.UTC(2024, (i % 6) + 3, 1 + (i % 27))).toISOString();

/** Admin "ok" guard result. */
const okAdmin = { ok: true, user: { id: "admin-1", role: "Admin" } };

/** Build a moderately-sized dataset of recognized/in-range rows. */
function buildDatasets() {
  const requestStatuses = ["pending", "approved", "rejected"];
  const requests = Array.from({ length: 300 }, (_, i) => ({
    status: requestStatuses[i % 3],
    createdAt: inPeriodDate(i),
  }));

  const feedback = Array.from({ length: 250 }, (_, i) => ({
    rating: (i % 5) + 1, // 1..5
    createdAt: inPeriodDate(i),
  }));

  const graves = Array.from({ length: 150 }, (_, i) => ({
    status: i % 2 === 0 ? "active" : "archived",
    burialDate: inPeriodDate(i),
    createdAt: inPeriodDate(i),
  }));

  const plots = Array.from({ length: 120 }, (_, i) => ({
    status: ["available", "occupied", "reserved", "maintenance"][i % 4],
    createdAt: inPeriodDate(i),
  }));

  return { requests, feedback, graves, plots };
}

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/reports/stats — breakdown timing & shape (task 15.4)", () => {
  it("computes breakdowns within the performance budget and returns partitioned totals (Req 11.5, 11.1, 11.2)", async () => {
    requireRole.mockResolvedValue(okAdmin);

    const { requests, feedback, graves, plots } = buildDatasets();
    prisma.grave.findMany.mockResolvedValue(graves);
    prisma.plot.findMany.mockResolvedValue(plots);
    prisma.request.findMany.mockResolvedValue(requests);
    prisma.feedback.findMany.mockResolvedValue(feedback);
    prisma.location.count.mockResolvedValue(7);
    prisma.user.count.mockResolvedValue(4);

    const request = new Request(REQUEST_URL);

    const start = performance.now();
    const response = await GET(request);
    const elapsedMs = performance.now() - start;

    // Req 11.5: well within the 3-second budget (in practice a few ms).
    expect(elapsedMs).toBeLessThan(PERFORMANCE_BUDGET_MS);

    expect(response.status).toBe(200);
    const body = await response.json();

    // Req 11.1: request status breakdown present with all three statuses.
    expect(body.requests.byStatus).toEqual(
      expect.objectContaining({
        pending: expect.any(Number),
        approved: expect.any(Number),
        rejected: expect.any(Number),
      })
    );

    // Req 11.2: feedback distribution present with buckets 1–5.
    for (const bucket of [1, 2, 3, 4, 5]) {
      expect(body.feedback.distribution).toHaveProperty(String(bucket));
      expect(typeof body.feedback.distribution[bucket]).toBe("number");
    }

    // All inputs are recognized/in-range, so breakdowns partition the totals.
    expect(sum(body.requests.byStatus)).toBe(body.requests.total);
    expect(sum(body.feedback.distribution)).toBe(body.feedback.total);

    // Sanity: the fake datasets were actually aggregated.
    expect(body.requests.total).toBe(requests.length);
    expect(body.feedback.total).toBe(feedback.length);
  });
});

describe("GET /api/reports/stats — empty period (task 15.4)", () => {
  it("returns 200 with every breakdown group present at zero, not an error (Req 11.4)", async () => {
    requireRole.mockResolvedValue(okAdmin);

    prisma.grave.findMany.mockResolvedValue([]);
    prisma.plot.findMany.mockResolvedValue([]);
    prisma.request.findMany.mockResolvedValue([]);
    prisma.feedback.findMany.mockResolvedValue([]);
    prisma.location.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);

    const response = await GET(new Request(REQUEST_URL));

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.requests.total).toBe(0);
    for (const status of ["pending", "approved", "rejected"]) {
      expect(body.requests.byStatus[status]).toBe(0);
    }

    expect(body.feedback.total).toBe(0);
    for (const bucket of [1, 2, 3, 4, 5]) {
      expect(body.feedback.distribution[bucket]).toBe(0);
    }

    expect(body.graves.total).toBe(0);
    expect(body.plots.total).toBe(0);
  });
});

describe("GET /api/reports/stats — admin-only access (task 15.4)", () => {
  it("returns the guard's rejection response and never queries the database", async () => {
    const forbidden = new Response(
      JSON.stringify({ error: { type: "forbidden", message: "no" } }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
    requireRole.mockResolvedValue({ ok: false, response: forbidden });

    const response = await GET(new Request(REQUEST_URL));

    expect(response).toBe(forbidden);
    expect(response.status).toBe(403);

    expect(prisma.grave.findMany).not.toHaveBeenCalled();
    expect(prisma.plot.findMany).not.toHaveBeenCalled();
    expect(prisma.request.findMany).not.toHaveBeenCalled();
    expect(prisma.feedback.findMany).not.toHaveBeenCalled();
    expect(prisma.location.count).not.toHaveBeenCalled();
    expect(prisma.user.count).not.toHaveBeenCalled();
  });
});
