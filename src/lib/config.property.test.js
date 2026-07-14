import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

import { resolveMapCenter, DEFAULT_MAP_CENTER } from "@/lib/config";

const NUM_RUNS = 100;

/** Oracle mirroring the documented validity contract of resolveMapCenter. */
function isAbsent(v) {
  return v === undefined || v === null || v === "";
}
function coordIsValid(raw, absent, min, max) {
  if (absent) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max;
}

/** Latitude values that parse to a finite number inside [-90, 90]. */
const arbValidLat = fc
  .double({ min: -90, max: 90, noNaN: true })
  .filter((n) => Number.isFinite(n));
/** Longitude values that parse to a finite number inside [-180, 180]. */
const arbValidLng = fc
  .double({ min: -180, max: 180, noNaN: true })
  .filter((n) => Number.isFinite(n));

/** Out-of-range numeric coordinate (as string, like a real env var). */
const arbOutOfRangeLat = fc
  .oneof(fc.double({ min: 90.0001, max: 1e6 }), fc.double({ min: -1e6, max: -90.0001 }))
  .filter((n) => Number.isFinite(n))
  .map(String);
const arbOutOfRangeLng = fc
  .oneof(fc.double({ min: 180.0001, max: 1e6 }), fc.double({ min: -1e6, max: -180.0001 }))
  .filter((n) => Number.isFinite(n))
  .map(String);

/** Non-numeric string that Number() cannot parse to a finite value. */
const arbNonNumeric = fc
  .string({ minLength: 1 })
  .filter((s) => !Number.isFinite(Number(s)));

/** Absent representations of a coordinate. */
const arbAbsent = fc.constantFrom(undefined, null, "");

/**
 * Env generator covering every documented case:
 *  - both valid pairs
 *  - both absent
 *  - one missing (partial)
 *  - out of range
 *  - non-numeric strings
 * Values are emitted as strings for present coords to mimic real env vars,
 * except the valid-pair case which also exercises numeric values.
 */
const arbEnv = fc.oneof(
  // Valid pair (numbers)
  fc.record({ MAP_CENTER_LAT: arbValidLat, MAP_CENTER_LNG: arbValidLng }),
  // Valid pair (strings)
  fc.record({
    MAP_CENTER_LAT: arbValidLat.map(String),
    MAP_CENTER_LNG: arbValidLng.map(String),
  }),
  // Both absent
  fc.record({ MAP_CENTER_LAT: arbAbsent, MAP_CENTER_LNG: arbAbsent }),
  // Partial: lat present/valid, lng absent
  fc.record({ MAP_CENTER_LAT: arbValidLat.map(String), MAP_CENTER_LNG: arbAbsent }),
  // Partial: lng present/valid, lat absent
  fc.record({ MAP_CENTER_LAT: arbAbsent, MAP_CENTER_LNG: arbValidLng.map(String) }),
  // Out of range
  fc.record({ MAP_CENTER_LAT: arbOutOfRangeLat, MAP_CENTER_LNG: arbOutOfRangeLng }),
  // Non-numeric
  fc.record({ MAP_CENTER_LAT: arbNonNumeric, MAP_CENTER_LNG: arbNonNumeric }),
  // Mixed valid + garbage
  fc.record({ MAP_CENTER_LAT: arbValidLat.map(String), MAP_CENTER_LNG: arbNonNumeric }),
  fc.record({ MAP_CENTER_LAT: arbOutOfRangeLat, MAP_CENTER_LNG: arbValidLng.map(String) })
);

describe("config property tests", () => {
  // Property 23 (design): Map center resolves to configured value or documented default.
  // Validates: Requirements 13.1, 13.2, 13.3
  test("Property 23: resolveMapCenter returns config value, plain default, or default+invalid", () => {
    fc.assert(
      fc.property(arbEnv, (env) => {
        const result = resolveMapCenter(env);

        const latAbsent = isAbsent(env.MAP_CENTER_LAT);
        const lngAbsent = isAbsent(env.MAP_CENTER_LNG);
        const latValid = coordIsValid(env.MAP_CENTER_LAT, latAbsent, -90, 90);
        const lngValid = coordIsValid(env.MAP_CENTER_LNG, lngAbsent, -180, 180);

        if (latValid && lngValid) {
          // Configured center (Req 13.1)
          expect(result).toEqual({
            lat: Number(env.MAP_CENTER_LAT),
            lng: Number(env.MAP_CENTER_LNG),
            source: "config",
          });
          expect(result.invalid).toBeUndefined();
        } else if (latAbsent && lngAbsent) {
          // Both absent -> plain default, no invalid flag (Req 13.2)
          expect(result).toEqual({
            lat: DEFAULT_MAP_CENTER.lat,
            lng: DEFAULT_MAP_CENTER.lng,
            source: "default",
          });
          expect(result.invalid).toBeUndefined();
        } else {
          // Partial / out-of-range / non-numeric -> default + invalid (Req 13.3)
          expect(result).toEqual({
            lat: DEFAULT_MAP_CENTER.lat,
            lng: DEFAULT_MAP_CENTER.lng,
            source: "default",
            invalid: true,
          });
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Smoke test (task 18.3): map components source their center from config, no hardcoded coords.
  // Validates: Requirement 13.4
  describe("Smoke: map components source center from config (Req 13.4)", () => {
    const componentFiles = ["CemeteryMap.js", "MapPicker.js"];

    for (const file of componentFiles) {
      test(`${file} imports config and contains no hardcoded default coordinates`, () => {
        const path = fileURLToPath(new URL(`../components/${file}`, import.meta.url));
        const source = readFileSync(path, "utf8");

        // (a) It sources the center from the config module.
        const importsConfig =
          source.includes("getClientMapCenter") || source.includes("../lib/config");
        expect(importsConfig).toBe(true);

        // (b) It does NOT hardcode the documented default center literals.
        expect(source).not.toContain("8.4647");
        expect(source).not.toContain("124.6578");
      });
    }
  });
});
