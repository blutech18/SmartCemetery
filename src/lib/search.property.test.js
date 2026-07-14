/**
 * Property-based tests for the smart search engine (src/lib/search.js).
 *
 * Covers design correctness property:
 *   - Property 14 (task 9.4): Search results include archived records.
 *
 * Framework: Vitest + fast-check. `smartSearch` takes Prisma via dependency
 * injection, so a fake in-memory Prisma stub is supplied. The stub honors the
 * exact query shape `smartSearch` builds — a case-insensitive `deceasedName`
 * `contains` filter with NO status filter — so the test never touches a real
 * database.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { smartSearch } from "@/lib/search";

const NUM_RUNS = 150;

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const letterArb = fc.constantFrom(...LETTERS);
const wordArb = (min, max) =>
  fc.array(letterArb, { minLength: min, maxLength: max }).map((a) => a.join(""));

// A non-empty lowercase query token used for the `contains` match.
const queryArb = wordArb(1, 5);

/**
 * Build a fake Prisma stub for `smartSearch`. `grave.findMany({ where })`
 * filters the in-memory `rows` by the `deceasedName.contains` clause using a
 * case-insensitive substring match, applying NO status filter (archived rows
 * are eligible). The most recent `where` argument is recorded so the test can
 * assert the query shape.
 */
function makeFakePrisma(rows) {
  const calls = [];
  const prisma = {
    grave: {
      findMany: async (args = {}) => {
        calls.push(args);
        const where = args.where;
        if (!where || !where.deceasedName) {
          // Phonetic-fallback call: return everything (no filter).
          return rows.slice();
        }
        const needle = where.deceasedName.contains.toLowerCase();
        return rows.filter(
          (r) =>
            typeof r.deceasedName === "string" &&
            r.deceasedName.toLowerCase().includes(needle)
        );
      },
    },
  };
  return { prisma, calls };
}

/**
 * Property 14 (task 9.4): For any collection of graves containing archived
 * records whose names match a query, `smartSearch` returns those archived
 * records among the exact results (it applies no status filter, so archived
 * records are included just like active ones).
 *
 * **Validates: Requirements 6.4**
 */
describe("Property 14: Search results include archived records", () => {
  it("includes archived records whose names match the query", async () => {
    // Build graves that embed the query token in their name (so the exact
    // `contains` branch fires). At least one archived matching grave is
    // guaranteed; other graves add active matches and noise.
    const matchingGraveArb = (query, status) =>
      fc.record({
        id: fc.uuid(),
        deceasedName: fc
          .tuple(wordArb(0, 4), wordArb(0, 4))
          .map(([pre, post]) => `${pre}${query}${post}`),
        status: fc.constant(status),
      });

    const scenarioArb = queryArb.chain((query) =>
      fc.record({
        query: fc.constant(query),
        // >= 1 archived grave whose name contains the query.
        archivedMatches: fc.array(matchingGraveArb(query, "archived"), {
          minLength: 1,
          maxLength: 6,
        }),
        // Optional active matches.
        activeMatches: fc.array(matchingGraveArb(query, "active"), {
          minLength: 0,
          maxLength: 4,
        }),
        // Noise graves with random names (may or may not match).
        noise: fc.array(
          fc.record({
            id: fc.uuid(),
            deceasedName: wordArb(1, 8),
            status: fc.constantFrom("active", "archived", "pending"),
          }),
          { minLength: 0, maxLength: 6 }
        ),
      })
    );

    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ query, archivedMatches, activeMatches, noise }) => {
        const rows = [...archivedMatches, ...activeMatches, ...noise];
        const { prisma, calls } = makeFakePrisma(rows);

        const result = await smartSearch(prisma, query);

        // The exact-match branch fires (matches exist), so no phonetic fallback.
        expect(result.suggestions).toEqual([]);

        // Every archived matching record is present in the exact results.
        const resultIds = new Set(result.exact.map((g) => g.id));
        for (const archived of archivedMatches) {
          expect(resultIds.has(archived.id)).toBe(true);
        }

        // The query applied a `deceasedName.contains` filter and NO status
        // filter — confirming archived records are not excluded.
        expect(calls.length).toBeGreaterThan(0);
        const where = calls[0].where;
        expect(where.deceasedName.contains).toBe(query);
        expect(where).not.toHaveProperty("status");
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
