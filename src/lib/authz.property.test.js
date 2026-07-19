/**
 * Property-based tests for the authorization guard (src/lib/authz.js).
 *
 * Covers design correctness properties:
 *   - Property 4 (task 2.7): Authorization decision matches the permission matrix.
 *   - Property 5 (task 2.8): Unauthenticated/unauthorized requests are rejected
 *     before any mutation runs.
 *
 * Framework: Vitest + fast-check. `getToken` from "next-auth/jwt" is mocked so
 * `requireRole` can be exercised without a real request or signed JWT.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";

// Mock the JWT reader and active-account lookup before importing the module.
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { PERMISSIONS, ROLES, isAuthorized, requireRole } from "@/lib/authz";

const RESOURCE_KEYS = Object.keys(PERMISSIONS);
const UNKNOWN_RESOURCES = ["", "unknown", "__proto__", "toString", "random-key"];

// Roles outside the recognized set (case-sensitive, wrong types, etc.).
const INVALID_ROLES = ["admin", "STAFF", "client", "bogus", "", "Root", "42"];

const NUM_RUNS = 120;

/**
 * Property 4 (task 2.7): For any role (valid or invalid) and any resource key
 * (known or unknown), `isAuthorized(role, resource)` returns true iff the role
 * is listed under `PERMISSIONS[resource]`.
 *
 * **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
 */
describe("Property 4: Authorization decision matches the permission matrix", () => {
  it("returns true iff role is in PERMISSIONS[resource]", () => {
    const roleArb = fc.constantFrom(...ROLES, ...INVALID_ROLES);
    const resourceArb = fc.constantFrom(...RESOURCE_KEYS, ...UNKNOWN_RESOURCES);

    fc.assert(
      fc.property(roleArb, resourceArb, (role, resource) => {
        const allowed = PERMISSIONS[resource];
        const expected = Array.isArray(allowed) && allowed.includes(role);
        expect(isAuthorized(role, resource)).toBe(expected);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

/**
 * Property 5 (task 2.8): For any mutating request, a missing/expired/malformed
 * JWT or an unrecognized role yields 401; a recognized role lacking permission
 * yields 403; in both cases the wrapped mutation is never invoked.
 *
 * **Validates: Requirements 2.1, 2.2, 2.7**
 */
describe("Property 5: Unauthenticated or unauthorized requests are rejected before any mutation", () => {
  beforeEach(() => {
    getToken.mockReset();
    prisma.user.findUnique.mockReset();
  });

  // Wrapper mirroring how a route handler uses the guard: the mutation only
  // runs when the guard returns ok.
  async function guardedMutate(request, resource, mutate) {
    const result = await requireRole(request, resource);
    if (result.ok) {
      const value = await mutate();
      return { ok: true, value };
    }
    return { ok: false, response: result.response };
  }

  // --- 401 scenarios: missing / expired / malformed token, or unknown role ---
  // getToken returns null for missing/expired/malformed tokens; a decoded token
  // whose role is not one of ROLES is also rejected with 401.
  const unauth401Arb = fc.oneof(
    // Missing / expired / malformed -> getToken resolves null (or throws,
    // which readToken maps to null).
    fc.constant({ token: null }),
    fc.constant({ token: { id: "disabled-user", role: "Admin", disabled: true } }),
    // Recognized-looking object but role not in ROLES.
    fc.record({
      token: fc.record({
        id: fc.string(),
        role: fc.constantFrom(...INVALID_ROLES, undefined, null, 123),
      }),
    })
  );

  it("rejects unauthenticated / unrecognized-role requests with 401 and never mutates", async () => {
    await fc.assert(
      fc.asyncProperty(
        unauth401Arb,
        fc.constantFrom(...RESOURCE_KEYS),
        async ({ token }, resource) => {
          getToken.mockResolvedValueOnce(token);
          const mutate = vi.fn(async () => "mutated");

          const outcome = await guardedMutate({}, resource, mutate);

          expect(outcome.ok).toBe(false);
          expect(outcome.response.status).toBe(401);
          expect(mutate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // --- 403 scenarios: recognized role that lacks permission for the resource ---
  // Admin is permitted everywhere, so only Staff/Client can produce a 403.
  const forbidden403Arb = fc
    .constantFrom("Staff", "Client")
    .chain((role) => {
      const disallowed = RESOURCE_KEYS.filter(
        (r) => !PERMISSIONS[r].includes(role)
      );
      return fc.record({
        role: fc.constant(role),
        resource: fc.constantFrom(...disallowed),
      });
    });

  it("rejects recognized-but-unauthorized roles with 403 and never mutates", async () => {
    await fc.assert(
      fc.asyncProperty(forbidden403Arb, async ({ role, resource }) => {
        getToken.mockResolvedValueOnce({ id: "1", role });
        prisma.user.findUnique.mockResolvedValueOnce({
          status: "active",
          userType: { typeName: role },
        });
        const mutate = vi.fn(async () => "mutated");

        const outcome = await guardedMutate({}, resource, mutate);

        expect(outcome.ok).toBe(false);
        expect(outcome.response.status).toBe(403);
        expect(mutate).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
