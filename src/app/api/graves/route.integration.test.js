import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";

// A valid 32-byte (64 hex char) key so the REAL encryption helpers run and we
// can assert encrypted-at-rest storage + decrypted round-trips. Set before the
// route (and its encryption import) is exercised; the encryption module reads
// process.env.ENCRYPTION_KEY lazily at call time.
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// --- Mock collaborators so no DB / JWT / network is required ------------------

// Controllable Prisma stub.
vi.mock("@/lib/db", () => ({
  prisma: {
    grave: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    plot: { findUnique: vi.fn(), update: vi.fn() },
    graveDetail: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Authorization guard — controlled per test.
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));

// Search helper (imported by the route) — never used on the paths under test,
// but must exist so the module loads.
vi.mock("@/lib/search", () => ({ smartSearch: vi.fn() }));

// Audit helpers — spy on writeAuditLog; give getClientIp a fixed return.
vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

// Keep validateBody / validationErrorResponse REAL; only checkDuplicateGrave is
// mocked so we can drive the duplicate-gating behaviour directly.
vi.mock("@/lib/validation", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, checkDuplicateGrave: vi.fn() };
});

import { NextResponse } from "next/server";
import { GET, POST } from "@/app/api/graves/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { checkDuplicateGrave } from "@/lib/validation";
import { decrypt, encryptGraveDetail } from "@/lib/encryption";

// --- Helpers -----------------------------------------------------------------

function postRequest(body) {
  return new Request("http://localhost/api/graves", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
  });
}

function getRequest(query = "") {
  return new Request(`http://localhost/api/graves${query}`, { method: "GET" });
}

// Holds the last tx object handed to prisma.$transaction so tests can assert on
// the individual tx.* mutation calls.
let lastTx;
// Captures the encrypted data passed to graveDetail.create inside the tx.
let createdDetailData;

function installTransaction() {
  prisma.$transaction.mockImplementation(async (fn) => {
    const tx = {
      grave: {
        create: vi.fn(async ({ data }) => ({ id: 100, ...data })),
        findUnique: vi.fn(async () => ({
          id: 100,
          deceasedName: "Test Person",
          plotId: 10,
          details: createdDetailData ?? null,
        })),
      },
      graveDetail: {
        create: vi.fn(async ({ data }) => {
          createdDetailData = data;
          return data;
        }),
      },
      plot: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => ({ status: "available" })),
      },
    };
    lastTx = tx;
    return fn(tx);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  lastTx = undefined;
  createdDetailData = undefined;

  // Sensible success defaults; individual tests override as needed.
  requireRole.mockResolvedValue({ ok: true, user: { id: 1, role: "Admin" } });
  checkDuplicateGrave.mockResolvedValue({ hasDuplicate: false, duplicates: [] });
  prisma.plot.findUnique.mockResolvedValue({ id: 10, status: "available" });
  prisma.plot.update.mockResolvedValue({});
  installTransaction();
});

// =============================================================================
// Task 5.2 — Integration tests for secured grave endpoints
// Requirements: 2.1, 2.4, 3.1, 3.2, 14.1, 14.3, 14.4
// =============================================================================
describe("Task 5.2 — secured grave endpoints", () => {
  it("gates POST on authorization: unauthorized returns the guard response and performs NO mutation (Req 2.1, 2.4)", async () => {
    for (const status of [401, 403]) {
      vi.clearAllMocks();
      installTransaction();
      requireRole.mockResolvedValue({
        ok: false,
        response: NextResponse.json(
          { error: { type: "auth", message: "denied" } },
          { status }
        ),
      });

      const res = await POST(
        postRequest({ deceasedName: "Jane Doe", plotId: 10 })
      );

      expect(res.status).toBe(status);
      // No mutation path was entered at all.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.plot.findUnique).not.toHaveBeenCalled();
      expect(checkDuplicateGrave).not.toHaveBeenCalled();
      expect(writeAuditLog).not.toHaveBeenCalled();
    }
  });

  it("stores sensitive fields encrypted-at-rest on successful POST (Req 3.1)", async () => {
    const plaintext = {
      contactPerson: "Jane Doe",
      contactPhone: "+15551234567",
      causeOfDeath: "Natural causes",
      notes: "Some free-form note",
    };

    const res = await POST(
      postRequest({
        deceasedName: "John Smith",
        plotId: 10,
        burialDate: "2024-01-01",
        ...plaintext,
      })
    );

    expect(res.status).toBe(201);
    expect(createdDetailData).toBeTruthy();

    // The three sensitive fields must be stored as ciphertext envelopes, never
    // as the raw plaintext.
    for (const field of ["contactPerson", "contactPhone", "causeOfDeath"]) {
      const stored = createdDetailData[field];
      expect(stored).not.toBe(plaintext[field]);
      expect(stored).not.toContain(plaintext[field]);
      // Real decrypt round-trips back to the original plaintext.
      expect(decrypt(stored)).toBe(plaintext[field]);
    }
  });

  it("writes exactly one audit entry per persisted mutation (Req 14.1, 14.3, 14.4)", async () => {
    const res = await POST(
      postRequest({ deceasedName: "John Smith", plotId: 10 })
    );

    expect(res.status).toBe(201);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        action: "grave.create",
        ipAddress: "1.2.3.4",
      })
    );
  });

  it("returns sensitive details as decrypted plaintext for authorized GET (Req 3.2)", async () => {
    const plaintext = {
      contactPerson: "Mary Major",
      contactPhone: "+15559876543",
      causeOfDeath: "Illness",
      notes: "note",
    };
    const encrypted = encryptGraveDetail(plaintext);

    requireRole.mockResolvedValue({ ok: true, user: { id: 1, role: "Admin" } });
    prisma.grave.findMany.mockResolvedValue([
      { id: 1, deceasedName: "Somebody", details: { ...encrypted } },
    ]);
    prisma.grave.count.mockResolvedValue(1);

    const res = await GET(getRequest("?page=1&limit=20"));
    expect(res.status).toBe(200);
    const body = await res.json();

    const details = body.graves[0].details;
    expect(details.contactPerson).toBe(plaintext.contactPerson);
    expect(details.contactPhone).toBe(plaintext.contactPhone);
    expect(details.causeOfDeath).toBe(plaintext.causeOfDeath);
  });

  it("strips sensitive details for unauthorized GET (never leaks ciphertext) (Req 3.2)", async () => {
    const encrypted = encryptGraveDetail({
      contactPerson: "Mary Major",
      contactPhone: "+15559876543",
      causeOfDeath: "Illness",
      notes: "note",
    });

    requireRole
      .mockResolvedValueOnce({ ok: false, response: null })
      .mockResolvedValueOnce({ ok: true, user: { id: 2, role: "Staff" } });
    prisma.grave.findMany.mockResolvedValue([
      { id: 1, deceasedName: "Somebody", details: { ...encrypted } },
    ]);
    prisma.grave.count.mockResolvedValue(1);

    const res = await GET(getRequest("?page=1&limit=20"));
    expect(res.status).toBe(200);
    const body = await res.json();

    const details = body.graves[0].details;
    expect(details).not.toHaveProperty("contactPerson");
    expect(details).not.toHaveProperty("contactPhone");
    expect(details).not.toHaveProperty("causeOfDeath");
    expect(details).not.toHaveProperty("notes");
    expect(details).not.toHaveProperty("encryptionKeyVersion");
    expect(details).not.toHaveProperty("notesEncrypted");
  });
});

// =============================================================================
// Task 7.4 — Property 10: creation gated by duplicates + confirmation flag
// Validates: Requirements 4.2, 4.3, 4.4
// =============================================================================
describe("Task 7.4 — Property 10: creation gating", () => {
  it("blocks with 409 (no creation) IFF a duplicate exists AND confirm !== true; otherwise creation proceeds", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.oneof(
          fc.constant(true),
          fc.constant(false),
          fc.constant(undefined),
          fc.constant("true"),
          fc.constant(1),
          fc.constant(null)
        ),
        async (hasDuplicate, confirm) => {
          vi.clearAllMocks();
          createdDetailData = undefined;
          requireRole.mockResolvedValue({
            ok: true,
            user: { id: 1, role: "Admin" },
          });
          prisma.plot.findUnique.mockResolvedValue({
            id: 10,
            status: "available",
          });
          prisma.plot.update.mockResolvedValue({});
          installTransaction();
          checkDuplicateGrave.mockResolvedValue({
            hasDuplicate,
            duplicates: hasDuplicate ? [{ id: 7 }] : [],
          });

          const body = { deceasedName: "Jane Doe", plotId: 10 };
          if (confirm !== undefined) body.confirm = confirm;

          const res = await POST(postRequest(body));

          const shouldBlock = hasDuplicate === true && confirm !== true;

          if (shouldBlock) {
            expect(res.status).toBe(409);
            // No creation happened.
            expect(prisma.$transaction).not.toHaveBeenCalled();
          } else {
            // Creation proceeded through the transaction.
            expect(res.status).toBe(201);
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(lastTx.grave.create).toHaveBeenCalledTimes(1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// =============================================================================
// Task 7.5 — Unit: duplicate-detection failure aborts creation
// Requirements: 4.5
// =============================================================================
describe("Task 7.5 — duplicate-detection failure", () => {
  it("returns a 500 internal error and NEVER creates a record when detection throws (Req 4.5)", async () => {
    checkDuplicateGrave.mockRejectedValue(new Error("db down"));

    const res = await POST(
      postRequest({ deceasedName: "Jane Doe", plotId: 10 })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.type).toBe("internal");

    // Creation must not have been attempted.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.plot.findUnique).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
