/**
 * Property-based tests for the validation module (src/lib/validation.js).
 *
 * Framework: Vitest + fast-check (Node environment, `@/` -> src/ alias).
 *
 * Covers design properties:
 *   - Property 25 (task 3.2): validateBody enumerates exactly the failing fields
 *   - Property 26 (task 3.3): validationErrorResponse shares one uniform shape
 *   - Property 9  (task 7.2): isPotentialDuplicate name + burial-date window
 *   - Property 11 (task 8.2): validateRecordCompleteness partitions by completeness
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  validateBody,
  validationErrorResponse,
  isPotentialDuplicate,
  validateRecordCompleteness,
} from "@/lib/validation.js";

const RUNS = { numRuns: 100 };

// Lowercase-letter string of a bounded length (never empty, no whitespace),
// so trim + case-fold normalization leaves the core value unchanged.
const letters = (minLength, maxLength) =>
  fc
    .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), {
      minLength,
      maxLength,
    })
    .map((chars) => chars.join(""));

// -------------------------------------------------------------------------
// Property 25 (task 3.2): Validation enumerates exactly the failing fields
// and gates writes.
// Validates: Requirements 15.1, 15.2, 15.3, 15.4
// -------------------------------------------------------------------------
describe("Property 25: validateBody enumerates exactly the failing fields", () => {
  const schema = {
    name: { required: true, type: "string", trim: true, min: 1, max: 8 },
    age: { required: true, type: "integer", min: 0, max: 120 },
    status: { required: true, type: "string", enum: ["active", "inactive"] },
    score: { type: "number", min: 0, max: 100 }, // optional
  };

  // Each field arbitrary yields { value, fail }. A valid value never produces
  // an error; an invalid value is guaranteed to produce at least one error for
  // that field (missing required, wrong type, out-of-range, or bad enum).
  const field = (validArb, invalidArbs) =>
    fc.oneof(
      validArb.map((value) => ({ value, fail: false })),
      ...invalidArbs.map((arb) => arb.map((value) => ({ value, fail: true })))
    );

  const nameArb = field(letters(1, 8), [
    fc.constant(undefined), // missing required
    fc.integer(), // wrong type (not a string)
    letters(9, 16), // too long (> max length 8)
    fc.constantFrom("   ", " ", "\t\n"), // whitespace-only -> empty after trim
  ]);

  const ageArb = field(fc.integer({ min: 0, max: 120 }), [
    fc.constant(undefined), // missing required
    fc.integer({ min: 0, max: 100 }).map((n) => n + 0.5), // non-integer type
    fc.constantFrom("12", "abc"), // wrong type (string)
    fc.integer({ min: 121, max: 5000 }), // above max
    fc.integer({ min: -5000, max: -1 }), // below min
  ]);

  const statusArb = field(fc.constantFrom("active", "inactive"), [
    fc.constant(undefined), // missing required
    letters(3, 8).map((s) => `z${s}`), // not in enum
    fc.integer(), // wrong type (not a string)
  ]);

  // score is optional: a valid value may be absent (undefined) or an in-range
  // number, so an absent optional field must never appear as a failure.
  const scoreArb = field(
    fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 100 })),
    [
      fc.integer({ min: 101, max: 5000 }), // above max
      fc.integer({ min: -5000, max: -1 }), // below min
      fc.constantFrom("50", "x"), // wrong type (string)
    ]
  );

  it("returns exactly the failing field set and gates the write", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nameArb,
          age: ageArb,
          status: statusArb,
          score: scoreArb,
        }),
        (record) => {
          const body = {};
          const expectedFailing = new Set();
          for (const [name, gen] of Object.entries(record)) {
            body[name] = gen.value;
            if (gen.fail) expectedFailing.add(name);
          }

          const result = validateBody(body, schema);

          // Model the write being gated on validation success.
          let mutationInvoked = false;
          if (result.valid) mutationInvoked = true;

          if (expectedFailing.size === 0) {
            // All fields valid -> success, no write gating.
            expect(result.valid).toBe(true);
            expect(mutationInvoked).toBe(true);
            expect(result.value).toBeTypeOf("object");
          } else {
            // Any failure -> validation reports failure before the mutation runs.
            expect(result.valid).toBe(false);
            expect(mutationInvoked).toBe(false);
            expect(Array.isArray(result.errors)).toBe(true);

            // Errors cover EXACTLY the set of fields that should fail
            // (collected in one pass, never stopping at the first failure).
            const failingFields = new Set(result.errors.map((e) => e.field));
            expect(failingFields).toEqual(expectedFailing);
          }
        }
      ),
      RUNS
    );
  });
});

// -------------------------------------------------------------------------
// Property 26 (task 3.3): Validation error responses share one uniform shape.
// Validates: Requirements 15.5
// -------------------------------------------------------------------------
describe("Property 26: validationErrorResponse has one uniform shape", () => {
  const errorArb = fc.record({
    field: fc.string(),
    code: fc.constantFrom("required", "type", "enum", "min", "max"),
    message: fc.string(),
  });

  it("produces a 400 response with the { error: { type, message, fields } } shape", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(errorArb, { minLength: 1, maxLength: 10 }),
        async (errors) => {
          const response = validationErrorResponse(errors);

          expect(response.status).toBe(400);

          const payload = await response.json();
          expect(payload).toBeTypeOf("object");
          expect(payload.error).toBeTypeOf("object");
          expect(payload.error.type).toBe("validation");
          expect(payload.error.message).toBeTypeOf("string");
          expect(Array.isArray(payload.error.fields)).toBe(true);
          expect(payload.error.fields).toEqual(errors);
        }
      ),
      RUNS
    );
  });
});

// -------------------------------------------------------------------------
// Property 9 (task 7.2): Duplicate predicate matches on normalized name and
// burial-date window.
// Validates: Requirements 4.1
// -------------------------------------------------------------------------
describe("Property 9: isPotentialDuplicate name + burial-date window", () => {
  const ws = fc.constantFrom("", " ", "  ", "\t", " \t ");

  // Randomly re-case a lowercase string; case-folding removes the difference.
  const recase = (str, seed) =>
    [...str].map((c, i) => ((i + seed) % 2 === 0 ? c.toUpperCase() : c)).join("");

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  it("matches iff names are equal (trim+case-fold) and dates within 1 day", () => {
    fc.assert(
      fc.property(
        fc.record({
          core: letters(1, 8),
          sameName: fc.boolean(),
          leadA: ws,
          trailA: ws,
          leadB: ws,
          trailB: ws,
          caseSeedA: fc.integer({ min: 0, max: 1000 }),
          caseSeedB: fc.integer({ min: 0, max: 1000 }),
          baseMs: fc.integer({
            min: Date.UTC(2000, 0, 1),
            max: Date.UTC(2030, 0, 1),
          }),
          offsetDays: fc.integer({ min: -2, max: 2 }),
        }),
        (r) => {
          // coreB differs (after normalization) exactly when sameName is false.
          const coreB = r.sameName ? r.core : `${r.core}q`;

          // Leading/trailing whitespace + case changes do not affect the
          // normalized value, so name equality is driven solely by sameName.
          const nameA = `${r.leadA}${recase(r.core, r.caseSeedA)}${r.trailA}`;
          const nameB = `${r.leadB}${recase(coreB, r.caseSeedB)}${r.trailB}`;

          const dateA = new Date(r.baseMs);
          const dateB = new Date(r.baseMs + r.offsetDays * MS_PER_DAY);

          const expected = r.sameName && Math.abs(r.offsetDays) <= 1;

          const actual = isPotentialDuplicate(
            { deceasedName: nameA, burialDate: dateA },
            { deceasedName: nameB, burialDate: dateB }
          );

          expect(actual).toBe(expected);
        }
      ),
      RUNS
    );
  });
});

// -------------------------------------------------------------------------
// Property 11 (task 8.2): Incomplete-record alert list partitions graves by
// completeness.
// Validates: Requirements 5.1, 5.3, 5.4
// -------------------------------------------------------------------------
describe("Property 11: validateRecordCompleteness partitions by completeness", () => {
  const CANONICAL = ["deceasedName", "burialDate", "plotId"];

  // deceasedName is missing when it is not a non-whitespace string.
  const deceasedNameArb = fc.oneof(
    letters(1, 8).map((value) => ({ value, missing: false })),
    fc
      .oneof(
        fc.constant(undefined),
        fc.constant(null),
        fc.constantFrom("", "   ", "\t"),
        fc.integer() // non-string
      )
      .map((value) => ({ value, missing: true }))
  );

  // burialDate / plotId are missing only when null or undefined.
  const nullableArb = (presentArb) =>
    fc.oneof(
      presentArb.map((value) => ({ value, missing: false })),
      fc.constantFrom(null, undefined).map((value) => ({ value, missing: true }))
    );

  const burialDateArb = nullableArb(
    fc.oneof(fc.constantFrom("2020-01-01"), fc.integer(), fc.constant(""))
  );
  const plotIdArb = nullableArb(
    fc.oneof(fc.integer(), fc.string(), fc.constant(""))
  );

  it("reports isComplete and the exact canonical set of missing fields", () => {
    fc.assert(
      fc.property(
        fc.record({
          deceasedName: deceasedNameArb,
          burialDate: burialDateArb,
          plotId: plotIdArb,
        }),
        (record) => {
          const graveData = {
            deceasedName: record.deceasedName.value,
            burialDate: record.burialDate.value,
            plotId: record.plotId.value,
          };

          const expectedMissing = CANONICAL.filter(
            (fieldName) => record[fieldName].missing
          );

          const result = validateRecordCompleteness(graveData);

          expect(result.isComplete).toBe(expectedMissing.length === 0);
          // `missing` contains EXACTLY the canonical names of the absent fields,
          // in canonical order.
          expect(result.missing).toEqual(expectedMissing);
        }
      ),
      RUNS
    );
  });
});
