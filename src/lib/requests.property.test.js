/**
 * Property-based tests for the requests module (src/lib/requests.js).
 *
 * Framework: Vitest + fast-check (Node environment, `@/` -> src/ alias).
 *
 * Covers design properties:
 *   - Property 15 (task 11.2): Request validation accepts only allowed type
 *                              and bounded (trimmed) description.
 *   - Property 16 (task 11.3): Generated Reference_IDs are unique.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { validateBody } from "@/lib/validation.js";
import {
  REQUEST_SCHEMA,
  REQUEST_TYPES,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  generateReferenceId,
  REFERENCE_ID_PREFIX,
  REFERENCE_ID_MAX_LENGTH,
} from "@/lib/requests.js";

const RUNS = { numRuns: 100 };

// -------------------------------------------------------------------------
// Property 15 (task 11.2): Request validation accepts only allowed type and
// bounded description.
//
// validateBody(body, REQUEST_SCHEMA) succeeds IFF:
//   - type ∈ {reservation, record_update, inquiry}, AND
//   - description, after trimming, has length in [1, 2000].
// Otherwise it fails, and the set of failing error `field`s equals exactly
// the set of offending fields.
//
// Validates: Requirements 7.1, 7.2, 7.3, 7.4
// -------------------------------------------------------------------------
describe("Property 15: Request validation accepts only allowed type and bounded description", () => {
  // A valid type tagged with its known validity.
  const validTypeArb = fc
    .constantFrom(...REQUEST_TYPES)
    .map((type) => ({ type, typeValid: true }));

  // An invalid type: wrong-case variants, unrelated words, empty/whitespace,
  // arbitrary strings, or an omitted (undefined) value. Filtered so nothing
  // accidentally lands on a real allowed type.
  const invalidTypeArb = fc
    .oneof(
      fc.constantFrom(
        "Reservation",
        "RESERVATION",
        "Record_Update",
        "RECORD_UPDATE",
        "Inquiry",
        "INQUIRY",
        "reserve",
        "update",
        "question",
        "",
        "   ",
        undefined
      ),
      fc.string()
    )
    .filter((type) => !REQUEST_TYPES.includes(type))
    .map((type) => ({ type, typeValid: false }));

  const typeArb = fc.oneof(validTypeArb, invalidTypeArb);

  // Whitespace padding that trim() fully removes.
  const padArb = fc.constantFrom("", " ", "  ", "\t", "\n", " \t \n ");

  // A description built from a whitespace-free core of a chosen length, wrapped
  // in optional whitespace. The trimmed length therefore equals the core length,
  // making validity deterministic. Length choices exercise the exact boundaries
  // (0, 1, 2000, 2001) plus random lengths. Sometimes the value is omitted.
  const descriptionArb = fc
    .oneof(
      fc.record({
        coreLen: fc.oneof(
          fc.constantFrom(0, 1, 2, DESCRIPTION_MAX, DESCRIPTION_MAX + 1),
          fc.integer({ min: 0, max: 2100 })
        ),
        lead: padArb,
        trail: padArb,
      }),
      // Omitted description entirely.
      fc.constant(null)
    )
    .map((spec) => {
      if (spec === null) {
        return { description: undefined, descValid: false };
      }
      const core = "a".repeat(spec.coreLen);
      const description = `${spec.lead}${core}${spec.trail}`;
      const descValid =
        spec.coreLen >= DESCRIPTION_MIN && spec.coreLen <= DESCRIPTION_MAX;
      return { description, descValid, trimmedCore: core };
    });

  it("succeeds iff type is allowed and trimmed description length is 1–2000, naming offending fields otherwise", () => {
    fc.assert(
      fc.property(typeArb, descriptionArb, (typeSpec, descSpec) => {
        const body = { type: typeSpec.type, description: descSpec.description };
        const result = validateBody(body, REQUEST_SCHEMA);

        const shouldSucceed = typeSpec.typeValid && descSpec.descValid;

        if (shouldSucceed) {
          expect(result.valid).toBe(true);
          // Coerced values reflect the (trimmed) inputs.
          expect(result.value.type).toBe(typeSpec.type);
          expect(result.value.description).toBe(descSpec.trimmedCore);
          return;
        }

        // Otherwise validation fails and enumerates exactly the offending fields.
        expect(result.valid).toBe(false);

        const failingFields = new Set(result.errors.map((e) => e.field));
        const expectedFields = new Set();
        if (!typeSpec.typeValid) expectedFields.add("type");
        if (!descSpec.descValid) expectedFields.add("description");

        expect(failingFields).toEqual(expectedFields);
      }),
      RUNS
    );
  });

  it("accepts exact boundary lengths and rejects just outside them", () => {
    const base = { type: REQUEST_TYPES[0] };

    // length 1 (min) and 2000 (max) are valid
    expect(
      validateBody({ ...base, description: "a".repeat(DESCRIPTION_MIN) }, REQUEST_SCHEMA)
        .valid
    ).toBe(true);
    expect(
      validateBody({ ...base, description: "a".repeat(DESCRIPTION_MAX) }, REQUEST_SCHEMA)
        .valid
    ).toBe(true);

    // length 0 (empty/whitespace) and 2001 are invalid on description
    for (const desc of ["", "   ", "a".repeat(DESCRIPTION_MAX + 1)]) {
      const res = validateBody({ ...base, description: desc }, REQUEST_SCHEMA);
      expect(res.valid).toBe(false);
      expect(new Set(res.errors.map((e) => e.field))).toEqual(
        new Set(["description"])
      );
    }
  });
});

// -------------------------------------------------------------------------
// Property 16 (task 11.3): Reference IDs are unique.
//
// For any number of generated Reference_IDs, every ID is distinct (the count of
// generated IDs equals the size of the set of IDs). Each also matches the format
// `REQ-<16 uppercase hex>` and is no longer than REFERENCE_ID_MAX_LENGTH.
//
// Validates: Requirements 7.7
// -------------------------------------------------------------------------
describe("Property 16: Reference IDs are unique", () => {
  const REFERENCE_ID_PATTERN = /^REQ-[0-9A-F]{16}$/;

  it("produces pairwise-distinct, well-formed IDs for any batch size (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 500 }), (count) => {
        const ids = Array.from({ length: count }, () => generateReferenceId());

        for (const id of ids) {
          expect(id).toMatch(REFERENCE_ID_PATTERN);
          expect(id.startsWith(REFERENCE_ID_PREFIX)).toBe(true);
          expect(id.length).toBeLessThanOrEqual(REFERENCE_ID_MAX_LENGTH);
        }

        // All distinct: set size equals generated count.
        expect(new Set(ids).size).toBe(ids.length);
      }),
      RUNS
    );
  });

  it("generates thousands of distinct IDs in a single large batch", () => {
    const N = 5000;
    const ids = new Set();
    for (let i = 0; i < N; i++) {
      const id = generateReferenceId();
      expect(id).toMatch(REFERENCE_ID_PATTERN);
      expect(id.length).toBeLessThanOrEqual(REFERENCE_ID_MAX_LENGTH);
      ids.add(id);
    }
    expect(ids.size).toBe(N);
  });
});
