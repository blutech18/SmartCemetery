/**
 * Property-based tests for the 5-year archival service (src/lib/archival.js).
 *
 * Covers design correctness properties:
 *   - Property 12 (task 9.2): Archival boundary is exactly five years before now.
 *   - Property 13 (task 9.3): Archival preserves all records and returns an
 *     accurate count.
 *
 * Framework: Vitest + fast-check. `shouldArchive` is pure; `archiveOldRecords`
 * takes Prisma via dependency injection, so a fake in-memory Prisma stub is
 * supplied — no real database is touched.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { shouldArchive, archiveOldRecords } from "@/lib/archival";

const NUM_RUNS = 150;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Reference definition of the archival cutoff, mirroring the spec's calendar
// rule (the instant exactly five years before `now`). Kept independent so the
// test asserts against the requirement, not the implementation's internals.
function referenceCutoff(now) {
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  return cutoff;
}

// `now` timestamps spanning a wide, realistic range (2000-01-01 .. 2050-01-01).
const nowArb = fc
  .integer({
    min: Date.UTC(2000, 0, 1),
    max: Date.UTC(2050, 0, 1),
  })
  .map((ms) => new Date(ms));

/**
 * Property 12 (task 9.2): For any burial date and reference time `now`,
 * `shouldArchive(burialDate, now)` returns true iff the burial date is strictly
 * more than five years before `now` (strictly before the cutoff). A date
 * exactly five years before `now` is NOT archived; one day earlier IS. A
 * null/undefined burial date is never archived.
 *
 * **Validates: Requirements 6.1**
 */
describe("Property 12: Archival boundary is exactly five years before now", () => {
  it("returns true iff burial date is strictly before the five-year cutoff", () => {
    // Offsets in ms relative to the exact cutoff, straddling the boundary:
    // exactly at the cutoff, +/- 1 ms, +/- 1 day, and larger random spans.
    const offsetArb = fc.oneof(
      fc.constantFrom(0, 1, -1, ONE_DAY_MS, -ONE_DAY_MS),
      fc.integer({ min: -10 * 365 * ONE_DAY_MS, max: 10 * 365 * ONE_DAY_MS })
    );

    fc.assert(
      fc.property(nowArb, offsetArb, (now, offset) => {
        const cutoff = referenceCutoff(now);
        const burialDate = new Date(cutoff.getTime() + offset);

        const expected = burialDate < cutoff;
        expect(shouldArchive(burialDate, now)).toBe(expected);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("treats a date exactly five years before now as NOT archived, one day earlier as archived", () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        const cutoff = referenceCutoff(now);

        // Exactly at the cutoff -> not archived.
        expect(shouldArchive(new Date(cutoff.getTime()), now)).toBe(false);
        // One day before the cutoff -> archived.
        expect(shouldArchive(new Date(cutoff.getTime() - ONE_DAY_MS), now)).toBe(
          true
        );
        // One day after the cutoff -> not archived.
        expect(shouldArchive(new Date(cutoff.getTime() + ONE_DAY_MS), now)).toBe(
          false
        );
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("never archives a null/undefined burial date", () => {
    fc.assert(
      fc.property(nowArb, fc.constantFrom(null, undefined), (now, empty) => {
        expect(shouldArchive(empty, now)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

/**
 * Build a fake in-memory Prisma stub whose `$transaction(fn)` simply runs
 * `fn(tx)` and whose `tx.grave.updateMany({where,data})` mutates the shared
 * in-memory rows — matching `status` and `burialDate < where.burialDate.lt` —
 * and returns `{ count }`. Records are never removed, mirroring the real
 * behavior under test.
 */
function makeFakePrisma(rows) {
  const tx = {
    grave: {
      updateMany: ({ where, data }) => {
        let count = 0;
        for (const row of rows) {
          const statusMatch = row.status === where.status;
          const dateMatch =
            row.burialDate != null &&
            new Date(row.burialDate) < where.burialDate.lt;
          if (statusMatch && dateMatch) {
            row.status = data.status;
            row.archivedAt = data.archivedAt;
            count++;
          }
        }
        return { count };
      },
    },
  };

  return {
    $transaction: async (fn) => fn(tx),
  };
}

// A grave record generator: unique-ish id, varied status, and a burial date
// that may be null or spread across the archival boundary.
const graveRecordArb = fc.record({
  id: fc.uuid(),
  status: fc.constantFrom("active", "archived", "pending", "active"),
  burialDate: fc.oneof(
    fc.constant(null),
    fc
      .integer({ min: Date.UTC(1990, 0, 1), max: Date.UTC(2049, 11, 31) })
      .map((ms) => new Date(ms).toISOString())
  ),
});

/**
 * Property 13 (task 9.3): For any collection of grave records and reference
 * time `now`, `archiveOldRecords` preserves the full multiset of record ids
 * (nothing deleted), reclassifies only ACTIVE records whose burial date is
 * strictly before the five-year cutoff (setting status "archived" + archivedAt),
 * leaves all other records untouched, and returns `archivedCount` equal to the
 * number of qualifying records (including 0 when none qualify).
 *
 * **Validates: Requirements 6.3, 6.5**
 */
describe("Property 13: Archival preserves all records and returns an accurate count", () => {
  it("preserves all ids, changes only qualifying records, and reports an accurate count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(graveRecordArb, { minLength: 0, maxLength: 40 }),
        nowArb,
        async (records, now) => {
          // Snapshot the original rows and id multiset before archival.
          const rows = records.map((r) => ({ ...r }));
          const originalById = new Map(rows.map((r, i) => [i, { ...r }]));
          const originalIdsSorted = rows.map((r) => r.id).sort();

          const cutoff = referenceCutoff(now);
          const qualifies = (r) =>
            r.status === "active" &&
            r.burialDate != null &&
            new Date(r.burialDate) < cutoff;
          const expectedCount = rows.filter(qualifies).length;

          const fakePrisma = makeFakePrisma(rows);
          const { archivedCount } = await archiveOldRecords(fakePrisma, now);

          // (c) Returned count equals the number of qualifying records (incl. 0).
          expect(archivedCount).toBe(expectedCount);

          // (a) The full multiset of ids is preserved — nothing deleted/added.
          expect(rows.length).toBe(records.length);
          expect(rows.map((r) => r.id).sort()).toEqual(originalIdsSorted);

          // (b) Only qualifying rows changed: archived + archivedAt=now; every
          //     other row is byte-for-byte unchanged.
          rows.forEach((row, i) => {
            const before = originalById.get(i);
            if (qualifies(before)) {
              expect(row.status).toBe("archived");
              expect(row.archivedAt).toBe(now);
            } else {
              expect(row.status).toBe(before.status);
              expect(row.archivedAt).toBe(before.archivedAt);
            }
          });
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("returns a count of 0 when no records qualify", async () => {
    await fc.assert(
      fc.asyncProperty(nowArb, async (now) => {
        const cutoff = referenceCutoff(now);
        // All records are non-qualifying: archived, or active but buried after
        // the cutoff, or with a null burial date.
        const rows = [
          { id: "a", status: "archived", burialDate: new Date(0).toISOString() },
          {
            id: "b",
            status: "active",
            burialDate: new Date(cutoff.getTime() + ONE_DAY_MS).toISOString(),
          },
          { id: "c", status: "active", burialDate: null },
        ];
        const fakePrisma = makeFakePrisma(rows);
        const { archivedCount } = await archiveOldRecords(fakePrisma, now);
        expect(archivedCount).toBe(0);
        expect(rows.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
