import { describe, test, expect } from "vitest";
import fc from "fast-check";

import { formatRouteSteps, evaluateNavigationGate } from "@/lib/navigation";

const NUM_RUNS = 100;

/** Arbitrary OSRM-like step object. */
const arbStep = fc.record(
  {
    maneuver: fc.record(
      {
        type: fc.constantFrom("turn", "continue", "depart", "arrive", "merge", "roundabout"),
        modifier: fc.constantFrom("left", "right", "straight", "slight left", "sharp right"),
      },
      { requiredKeys: [] }
    ),
    name: fc.oneof(fc.constant(""), fc.string()),
    distance: fc.oneof(
      fc.constant(0),
      fc.double({ min: 0, max: 5000, noNaN: true })
    ),
  },
  { requiredKeys: [] }
);

/** Non-array inputs that must yield []. */
const arbNonArray = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.string(),
  fc.integer(),
  fc.record({ steps: fc.array(arbStep) })
);

/** Valid latitude / longitude. */
const arbValidLat = fc.double({ min: -90, max: 90, noNaN: true });
const arbValidLng = fc.double({ min: -180, max: 180, noNaN: true });
const arbValidCoords = fc.record({ lat: arbValidLat, lng: arbValidLng });

/** Invalid coordinate pairs: missing, NaN, or out-of-range lat/lng. */
const arbOutOfRangeLat = fc.oneof(
  fc.double({ min: 90.0001, max: 1e6 }),
  fc.double({ min: -1e6, max: -90.0001 })
);
const arbOutOfRangeLng = fc.oneof(
  fc.double({ min: 180.0001, max: 1e6 }),
  fc.double({ min: -1e6, max: -180.0001 })
);
const arbBadNumber = fc.constantFrom(NaN, Infinity, -Infinity);
const arbBadValue = fc.oneof(arbBadNumber, fc.string(), fc.constant(undefined), fc.constant(null));

const arbInvalidCoords = fc.oneof(
  // Entirely missing / wrong type
  fc.constant(undefined),
  fc.constant(null),
  fc.constant({}),
  // Missing one field
  fc.record({ lat: arbValidLat }),
  fc.record({ lng: arbValidLng }),
  // Non-finite / non-numeric field
  fc.record({ lat: arbBadValue, lng: arbValidLng }),
  fc.record({ lat: arbValidLat, lng: arbBadValue }),
  fc.record({ lat: arbBadValue, lng: arbBadValue }),
  // Out of range
  fc.record({ lat: arbOutOfRangeLat, lng: arbValidLng }),
  fc.record({ lat: arbValidLat, lng: arbOutOfRangeLng })
);

describe("navigation property tests", () => {
  // Property 21 (design): Route steps are a contiguously numbered ordered list.
  // Validates: Requirement 12.2
  test("Property 21: formatRouteSteps yields contiguous 1..N numbering, order preserved", () => {
    fc.assert(
      fc.property(fc.array(arbStep, { maxLength: 40 }), (steps) => {
        const result = formatRouteSteps(steps);

        // Length matches input.
        expect(result).toHaveLength(steps.length);

        // step fields are exactly [1, 2, ..., N] with no gaps, in source order.
        const numbers = result.map((r) => r.step);
        const expected = steps.map((_, i) => i + 1);
        expect(numbers).toEqual(expected);

        // Every entry carries a non-empty instruction string.
        for (const entry of result) {
          expect(typeof entry.instruction).toBe("string");
          expect(entry.instruction.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test("Property 21: non-array input returns []", () => {
    fc.assert(
      fc.property(arbNonArray, (input) => {
        expect(formatRouteSteps(input)).toEqual([]);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Property 22 (design): Missing plot coordinates block routing and logging.
  // Validates: Requirement 12.4
  test("Property 22: invalid destination -> {ok:false, reason:'unavailable'}", () => {
    fc.assert(
      fc.property(
        fc.oneof(arbValidCoords, arbInvalidCoords),
        arbInvalidCoords,
        (origin, destination) => {
          const result = evaluateNavigationGate({ origin, destination });
          expect(result).toEqual({ ok: false, reason: "unavailable" });
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test("Property 22: valid destination but invalid origin -> {ok:false, reason:'invalid-origin'}", () => {
    fc.assert(
      fc.property(arbInvalidCoords, arbValidCoords, (origin, destination) => {
        const result = evaluateNavigationGate({ origin, destination });
        expect(result).toEqual({ ok: false, reason: "invalid-origin" });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test("Property 22: both valid -> {ok:true}", () => {
    fc.assert(
      fc.property(arbValidCoords, arbValidCoords, (origin, destination) => {
        const result = evaluateNavigationGate({ origin, destination });
        expect(result).toEqual({ ok: true });
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
