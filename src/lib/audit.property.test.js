import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

// audit.js imports `{ prisma } from "@/lib/db"` at module load. Mock it so that
// importing the module never opens a real DB connection. Only `getClientIp`
// (a pure function) is exercised here, so an empty prisma stub is sufficient.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getClientIp } from "@/lib/audit";

/**
 * Property 24 (task 3.5): Client IP extraction returns the address or empty string
 * Validates: Requirements 14.2
 *
 * Contract of getClientIp(request):
 *   - prefers the left-most (first) entry of `x-forwarded-for`
 *   - falls back to `x-real-ip`
 *   - returns "" when neither header yields a value
 *   - works for both Fetch-style `{ headers: new Headers({...}) }` and plain
 *     `{ headers: {...} }` requests
 */

// A "clean" IP-ish token: non-empty, contains no commas or whitespace, so it is
// unaffected by the impl's `.split(",")[0].trim()`. The function does not
// validate IP format, so arbitrary tokens are valid inputs.
const octet = fc.integer({ min: 0, max: 255 });
const ipv4 = fc.tuple(octet, octet, octet, octet).map((o) => o.join("."));
const arbitraryToken = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[,\s]/g, ""))
  .filter((s) => s.length > 0);
const ipToken = fc.oneof(ipv4, ipv4, arbitraryToken);

// Randomly present a header map as a Fetch Headers object or a plain object.
// For the plain-object form, optionally vary key casing to exercise the
// case-insensitive lookup path.
function buildRequest(headerMap, form, upperCaseKeys) {
  if (form === "none") return {}; // request with no `headers` property at all
  if (form === "fetch") {
    return { headers: new Headers(headerMap) };
  }
  // plain object form
  const plain = {};
  for (const [k, v] of Object.entries(headerMap)) {
    plain[upperCaseKeys ? k.toUpperCase() : k] = v;
  }
  return { headers: plain };
}

// Model a full scenario and its expected extraction result.
const scenario = fc
  .record({
    xff: fc.array(ipToken, { minLength: 0, maxLength: 4 }),
    realIp: fc.option(ipToken, { nil: undefined }),
    form: fc.constantFrom("fetch", "plain", "plain"),
    upperCaseKeys: fc.boolean(),
  })
  .map(({ xff, realIp, form, upperCaseKeys }) => {
    const headerMap = {};
    if (xff.length > 0) headerMap["x-forwarded-for"] = xff.join(", ");
    if (realIp !== undefined) headerMap["x-real-ip"] = realIp;

    let expected;
    if (xff.length > 0) expected = xff[0];
    else if (realIp !== undefined) expected = realIp;
    else expected = "";

    // When there are no headers at all, sometimes drop the headers property
    // entirely to exercise the missing-headers branch.
    const effectiveForm =
      Object.keys(headerMap).length === 0 && form === "plain" && upperCaseKeys
        ? "none"
        : form;

    return {
      request: buildRequest(headerMap, effectiveForm, upperCaseKeys),
      expected,
    };
  });

describe("Property 24 (task 3.5): getClientIp returns the address or empty string [Req 14.2]", () => {
  it("returns left-most x-forwarded-for, else x-real-ip, else '' — across Headers and plain-object forms", () => {
    fc.assert(
      fc.property(scenario, ({ request, expected }) => {
        const result = getClientIp(request);
        // Always a string.
        expect(typeof result).toBe("string");
        // Exact extraction behavior.
        expect(result).toBe(expected);
        // "" exactly when no IP header is available.
        if (expected === "") {
          expect(result).toBe("");
        } else {
          expect(result.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("x-forwarded-for takes precedence over x-real-ip and yields the left-most entry", () => {
    fc.assert(
      fc.property(
        fc.array(ipToken, { minLength: 1, maxLength: 5 }),
        ipToken,
        fc.constantFrom("fetch", "plain"),
        (xff, realIp, form) => {
          const headerMap = {
            "x-forwarded-for": xff.join(", "),
            "x-real-ip": realIp,
          };
          const request = buildRequest(headerMap, form, false);
          expect(getClientIp(request)).toBe(xff[0]);
        },
      ),
      { numRuns: 200 },
    );
  });

  // Deterministic edge cases.
  it("returns '' when the request has no headers property", () => {
    expect(getClientIp({})).toBe("");
    expect(getClientIp(undefined)).toBe("");
  });

  it("returns '' for empty headers (both Headers and plain object)", () => {
    expect(getClientIp({ headers: new Headers({}) })).toBe("");
    expect(getClientIp({ headers: {} })).toBe("");
  });

  it("returns x-real-ip when only x-real-ip is present", () => {
    expect(getClientIp({ headers: new Headers({ "x-real-ip": "9.9.9.9" }) })).toBe(
      "9.9.9.9",
    );
    expect(getClientIp({ headers: { "X-Real-IP": "9.9.9.9" } })).toBe("9.9.9.9");
  });

  it("returns the left-most IP for a multi-entry x-forwarded-for", () => {
    expect(
      getClientIp({
        headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" },
      }),
    ).toBe("1.1.1.1");
    expect(
      getClientIp({
        headers: new Headers({ "x-forwarded-for": " 4.4.4.4 , 5.5.5.5" }),
      }),
    ).toBe("4.4.4.4");
  });
});
