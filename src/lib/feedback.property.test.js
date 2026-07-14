/**
 * Property-based tests for feedback payload validation.
 *
 * Framework: Vitest + fast-check (Node environment, `@/` -> src/ alias).
 *
 * Covers design property:
 *   - Property 17 (task 12.2): Feedback validation enforces integer rating and
 *     comment bounds.
 *     Validates: Requirements 8.1, 8.2, 8.3, 8.4
 *
 * ---------------------------------------------------------------------------
 * Why the schema is REDECLARED here
 * ---------------------------------------------------------------------------
 * The real validation schema lives INLINE in `src/app/api/feedback/route.js` as
 * `feedbackSchema`. Importing that route handler would transitively pull in
 * Prisma and Next.js server internals, which we do not want in a pure unit test.
 * So we mirror the exact same schema object here and exercise it through the
 * pure `validateBody` helper from `@/lib/validation`. If the route's schema
 * changes, this copy must be updated to match.
 *
 * ---------------------------------------------------------------------------
 * Exact contract enforced by `validateBody` (mirrored by the model below)
 * ---------------------------------------------------------------------------
 * rating (required integer 1–5):
 *   - absent / null / ""        -> fails (naming "rating")
 *   - present but not an integer -> fails (naming "rating")
 *   - integer < 1 or > 5         -> fails (naming "rating")
 *   - integer 1–5                -> ok
 *
 * comment (optional string, trimmed, length 1–1000):
 *   - absent / null / undefined  -> ok (optional)
 *   - a string that TRIMS TO ""  -> ok. Because `comment` is optional and
 *     `trim: true`, an explicitly-provided empty or whitespace-only comment is
 *     trimmed to "" and then treated as an ABSENT optional field. The `min: 1`
 *     rule is therefore never reached for it, so it passes. (This is the real
 *     behavior of `validateBody`; the model below matches it precisely.)
 *   - a non-empty string trimming to length 1–1000 -> ok
 *   - a non-empty string trimming to length > 1000 -> fails (naming "comment")
 *   - a present non-string (e.g. number)           -> fails (naming "comment")
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { validateBody } from "@/lib/validation.js";

const RUNS = { numRuns: 200 };

// Mirrors `feedbackSchema` in src/app/api/feedback/route.js exactly.
const feedbackSchema = {
  rating: { required: true, type: "integer", min: 1, max: 5 },
  comment: { type: "string", trim: true, min: 1, max: 1000 },
};

/**
 * Independent model of the exact validity contract enforced by `validateBody`
 * for the feedback schema. Returns which fields (if any) should fail.
 */
function expectedFailingFields(body) {
  const failing = new Set();

  // --- rating: required integer 1–5 ---
  const rating = body.rating;
  const ratingEmpty = rating === undefined || rating === null || rating === "";
  if (ratingEmpty) {
    failing.add("rating"); // required
  } else if (!Number.isInteger(rating)) {
    failing.add("rating"); // wrong type
  } else if (rating < 1 || rating > 5) {
    failing.add("rating"); // out of range
  }

  // --- comment: optional string, trimmed, length 1–1000 ---
  if (Object.prototype.hasOwnProperty.call(body, "comment")) {
    let comment = body.comment;
    if (typeof comment === "string") {
      comment = comment.trim();
    }
    const commentEmpty =
      comment === undefined || comment === null || comment === "";
    if (commentEmpty) {
      // Optional + empty-after-trim -> skipped, valid.
    } else if (typeof comment !== "string") {
      failing.add("comment"); // present non-string -> type error
    } else if (comment.length > 1000) {
      failing.add("comment"); // too long
    }
    // A non-empty trimmed string always has length >= 1, so min:1 holds.
  }

  return failing;
}

const str = (len) => "a".repeat(len);

// rating generator: valid ints, out-of-range ints, non-integer floats,
// strings, and missing.
const ratingArb = fc.oneof(
  fc.integer({ min: 1, max: 5 }), // valid
  fc.integer({ min: 6, max: 1000 }), // above max
  fc.integer({ min: -1000, max: 0 }), // below min
  fc.integer({ min: 1, max: 5 }).map((n) => n + 0.5), // non-integer float
  fc.constantFrom("3", "abc", "5"), // string, wrong type
  fc.constant(undefined) // missing
);

// comment generator: absent, null, "", whitespace, length 1, 1000, 1001,
// random valid, too long, and a present non-string.
const commentArb = fc.oneof(
  fc.constant({ present: false }), // absent
  fc.constant({ present: true, value: null }), // null present -> treated absent
  fc.constant({ present: true, value: "" }), // empty string
  fc.constantFrom("   ", " ", "\t\n").map((value) => ({ present: true, value })), // whitespace-only
  fc.constant({ present: true, value: "a" }), // length 1 (boundary)
  fc.constant({ present: true, value: str(1000) }), // length 1000 (boundary)
  fc.constant({ present: true, value: str(1001) }), // length 1001 (boundary, too long)
  fc.integer({ min: 2, max: 1000 }).map((n) => ({ present: true, value: str(n) })), // random valid
  fc.integer({ min: 1001, max: 2000 }).map((n) => ({ present: true, value: str(n) })), // random too long
  fc.constantFrom("  hi  ", " ok ").map((value) => ({ present: true, value })), // padded valid
  fc.integer().map((value) => ({ present: true, value })) // present non-string
);

describe("Property 17: feedback validation enforces integer rating and comment bounds", () => {
  it("succeeds iff rating is an integer 1–5 and comment is absent or trims to length 1–1000", () => {
    fc.assert(
      fc.property(ratingArb, commentArb, (rating, commentGen) => {
        const body = { rating };
        if (commentGen.present) {
          body.comment = commentGen.value;
        }

        const expected = expectedFailingFields(body);
        const result = validateBody(body, feedbackSchema);

        if (expected.size === 0) {
          // Valid payload -> validation succeeds, returns coerced value.
          expect(result.valid).toBe(true);
          expect(result.value).toBeTypeOf("object");
          expect(result.value.rating).toBe(rating);
        } else {
          // Invalid payload -> HTTP 400 shape (valid:false) naming exactly the
          // offending field(s): rating and/or comment.
          expect(result.valid).toBe(false);
          const failingFields = new Set(result.errors.map((e) => e.field));
          expect(failingFields).toEqual(expected);
        }
      }),
      RUNS
    );
  });
});
