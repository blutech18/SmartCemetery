import { describe, test, expect } from "vitest";
import fc from "fast-check";

import {
  evaluateRouteAccess,
  resolveCallback,
  PUBLIC_PATHS,
  PUBLIC_API_PREFIXES,
} from "@/lib/route-access";

const NUM_RUNS = 100;

/**
 * Oracle for token validity mirroring the documented contract of
 * `isTokenValid`: a token is valid iff it is a non-null object carrying a
 * finite numeric `exp` (seconds) whose ms value is strictly greater than
 * `nowMs` (Req 1.2, 1.3).
 */
function tokenIsValid(token, nowMs) {
  if (!token || typeof token !== "object") return false;
  const { exp } = token;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
  return exp * 1000 > nowMs;
}

/** Arbitrary reference clock in epoch ms (2001-09..2033 range). */
const arbNowMs = fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 });

/** `exp` values (seconds) that straddle the plausible `now` range. */
const arbExpSeconds = fc.integer({ min: 900_000_000, max: 2_100_000_000 });

/**
 * Arbitrary token covering the full state space: absent (null/undefined),
 * well-formed with numeric `exp` (expired or valid depending on `now`),
 * present but with no `exp`, and malformed `exp` (non-numeric / non-finite).
 */
const arbToken = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
  fc.record({ role: fc.string() }),
  fc.record({ exp: fc.constantFrom(NaN, Infinity, -Infinity) }),
  fc.record({ exp: fc.oneof(fc.string(), fc.boolean()) }),
  fc.record({ exp: arbExpSeconds, role: fc.string() })
);

/** Arbitrary path segment for building dashboard subpaths. */
const arbDashboardPath = fc
  .array(fc.constantFrom("graves", "users", "reports", "map", "plots", "a1", "x-y", "42"), {
    maxLength: 4,
  })
  .map((segs) => "/dashboard" + segs.map((s) => "/" + s).join(""));

describe("route-access property tests", () => {
  // Property 1 (design): Dashboard access decision reflects authentication state.
  // Validates: Requirements 1.1, 1.2, 1.3
  test("Property 1: dashboard access allows iff token present, well-formed, unexpired", () => {
    fc.assert(
      fc.property(arbDashboardPath, arbToken, arbNowMs, (pathname, token, nowMs) => {
        const decision = evaluateRouteAccess({ pathname, token, now: nowMs });

        if (tokenIsValid(token, nowMs)) {
          expect(decision).toEqual({ action: "allow" });
        } else {
          expect(decision).toEqual({
            action: "redirect",
            to: "/login",
            callbackUrl: pathname,
          });
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Property 2 (design): Public paths always bypass authentication.
  // Validates: Requirements 1.4
  test("Property 2: public paths always allow regardless of token state", () => {
    // Build a public-path generator: root is matched exactly; every other
    // public page/API prefix is matched exactly or at a path boundary.
    const boundarySuffix = fc.oneof(
      fc.constant(""),
      fc.constantFrom("/sub", "/a/b", "?q=1", "#frag")
    );

    const nonRootBases = fc.constantFrom(
      ...PUBLIC_PATHS.filter((p) => p !== "/"),
      ...PUBLIC_API_PREFIXES
    );

    const arbPublicPath = fc.oneof(
      fc.constant("/"),
      fc.tuple(nonRootBases, boundarySuffix).map(([base, suffix]) => base + suffix)
    );

    fc.assert(
      fc.property(arbPublicPath, arbToken, arbNowMs, (pathname, token, nowMs) => {
        const decision = evaluateRouteAccess({ pathname, token, now: nowMs });
        expect(decision).toEqual({ action: "allow" });
      }),
      { numRuns: NUM_RUNS }
    );
  });

  // Property 3 (design): Callback resolution only honors internal dashboard paths.
  // Validates: Requirements 1.5
  test("Property 3: resolveCallback returns internal dashboard paths, else /dashboard", () => {
    // Categorized inputs plus arbitrary junk strings, each with an explicit
    // expectation derived from the documented contract.
    const internalDashboard = fc
      .array(fc.constantFrom("graves", "users", "reports", "a1"), { maxLength: 3 })
      .chain((segs) =>
        fc.constantFrom("", "/", "?tab=x", "#top").map((suffix) => {
          const base = "/dashboard" + segs.map((s) => "/" + s).join("");
          // "/dashboard/" boundary-matches; "/dashboard" alone matches exactly.
          const value = suffix === "/" && segs.length === 0 ? base + "/" : base + suffix;
          return { input: value, expected: value };
        })
      );

    const external = fc
      .tuple(fc.constantFrom("http://", "https://"), fc.domain())
      .map(([scheme, host]) => ({ input: scheme + host + "/dashboard", expected: "/dashboard" }));

    const protocolRelative = fc
      .domain()
      .map((host) => ({ input: "//" + host + "/dashboard", expected: "/dashboard" }));

    const backslashObfuscated = fc
      .constantFrom("/dashboard\\evil", "/\\dashboard", "\\dashboard", "/dashboard\\")
      .map((input) => ({ input, expected: "/dashboard" }));

    const nonDashboard = fc
      .constantFrom("/login", "/dashboardx", "/api/graves", "/search", "/", "/settings/x")
      .map((input) => ({ input, expected: "/dashboard" }));

    const emptyish = fc
      .constantFrom("", "   ", "\t", "\n")
      .map((input) => ({ input, expected: "/dashboard" }));

    const cases = fc.oneof(
      internalDashboard,
      external,
      protocolRelative,
      backslashObfuscated,
      nonDashboard,
      emptyish
    );

    fc.assert(
      fc.property(cases, ({ input, expected }) => {
        expect(resolveCallback(input)).toBe(expected);
      }),
      { numRuns: NUM_RUNS }
    );

    // Additional pass over fully arbitrary strings: the result must always be a
    // safe internal dashboard path — either exactly "/dashboard" or a boundary
    // match under "/dashboard" that echoes the trimmed input.
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = resolveCallback(input);
        const trimmed = typeof input === "string" ? input.trim() : "";
        const isInternalDashboard =
          trimmed === "/dashboard" ||
          trimmed.startsWith("/dashboard/") ||
          trimmed.startsWith("/dashboard?") ||
          trimmed.startsWith("/dashboard#");
        const safe =
          trimmed.startsWith("/") &&
          !trimmed.startsWith("//") &&
          !trimmed.includes("\\") &&
          isInternalDashboard;

        if (safe) {
          expect(result).toBe(trimmed);
        } else {
          expect(result).toBe("/dashboard");
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
