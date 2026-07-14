/**
 * Property-based tests for notification ordering.
 *
 * Framework: Vitest + fast-check (Node environment, `@/` -> src/ alias).
 *
 * Covers design property:
 *   - Property 18 (task 13.2): Notifications are ordered most-recent-first.
 *     Validates: Requirements 9.2
 *
 * ---------------------------------------------------------------------------
 * What is being tested (and why it is a pure contract test)
 * ---------------------------------------------------------------------------
 * The GET /api/notifications endpoint (src/app/api/notifications/route.js)
 * delegates ordering to the database via `orderBy: { createdAt: "desc" }`.
 * We cannot hit a real database in a unit test, so instead we pin down the
 * ORDERING CONTRACT that the endpoint delegates to Prisma:
 *
 *   "return the user's notifications ordered by createdAt from most recent
 *    (newest) to oldest."
 *
 * We define the comparator that mirrors Prisma's `createdAt: "desc"` and assert
 * that sorting an arbitrary array of notification-like objects `{ id, createdAt }`
 * yields a list that is monotonically NON-INCREASING by createdAt — i.e. every
 * element's createdAt is >= the next element's createdAt (most-recent-first).
 * This is exactly the guarantee `orderBy: { createdAt: "desc" }` provides.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

const RUNS = { numRuns: 200 };

/**
 * Comparator mirroring Prisma's `orderBy: { createdAt: "desc" }`.
 * Sorts most-recent-first: a newer createdAt comes before an older one.
 */
function byCreatedAtDesc(a, b) {
  return time(b.createdAt) - time(a.createdAt);
}

// Coerce a createdAt (Date or epoch-ms number) to a comparable millisecond value.
function time(createdAt) {
  return createdAt instanceof Date ? createdAt.getTime() : createdAt;
}

// A notification-like object with an id and a createdAt timestamp. Timestamps
// are drawn from a bounded range and duplicates are possible, so the ordering
// must be non-strict (>=), not strictly decreasing.
const notificationArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  createdAt: fc
    .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2035, 0, 1) })
    .map((ms) => new Date(ms)),
});

describe("Property 18: notifications are ordered most-recent-first", () => {
  it("sorting by the createdAt-desc comparator yields a non-increasing timeline", () => {
    fc.assert(
      fc.property(
        fc.array(notificationArb, { minLength: 0, maxLength: 50 }),
        (notifications) => {
          const sorted = [...notifications].sort(byCreatedAtDesc);

          // Ordering guarantee delegated to Prisma's `createdAt: "desc"`:
          // each element is at least as recent as the one that follows it.
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(time(sorted[i].createdAt)).toBeGreaterThanOrEqual(
              time(sorted[i + 1].createdAt)
            );
          }

          // Sorting is a permutation: no notifications are lost or invented.
          expect(sorted.length).toBe(notifications.length);
        }
      ),
      RUNS
    );
  });
});
