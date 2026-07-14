import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all collaborators so the handler's control flow is exercised in
// isolation. The archival endpoint's own logic (authorization branching,
// count reporting, audit write, error handling) is what we verify here.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/archival", () => ({ archiveOldRecords: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
  getClientIp: vi.fn(() => ""),
}));

import { POST } from "@/app/api/archival/route";
import { requireRole } from "@/lib/authz";
import { archiveOldRecords } from "@/lib/archival";
import { writeAuditLog } from "@/lib/audit";

/** Build a real Request whose x-archival-token header we control. */
function makePostRequest(headers = {}) {
  return new Request("http://localhost/api/archival", {
    method: "POST",
    headers: new Headers(headers),
  });
}

describe("POST /api/archival integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ARCHIVAL_CRON_SECRET;
    delete process.env.ARCHIVAL_SYSTEM_USER_ID;
  });

  it("returns 200 with archivedCount and audits the count when an Admin triggers it (Req 6.7)", async () => {
    const N = 7;
    requireRole.mockResolvedValueOnce({ ok: true, user: { id: 42, role: "Admin" } });
    archiveOldRecords.mockResolvedValueOnce({ archivedCount: N });

    const res = await POST(makePostRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ archivedCount: N });

    // Archival ran and the outcome was recorded in the audit log with the count.
    expect(archiveOldRecords).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    const auditArg = writeAuditLog.mock.calls[0][0];
    expect(auditArg.userId).toBe(42);
    expect(auditArg.action).toMatch(/grave\.archive.*count=7/);
  });

  it("returns 403 and never runs archival when unauthorized and no valid token (Req 6.6)", async () => {
    requireRole.mockResolvedValueOnce({ ok: false, response: undefined });

    const res = await POST(makePostRequest()); // no x-archival-token header

    expect(res.status).toBe(403);
    // No grave record is changed: archival must not be invoked.
    expect(archiveOldRecords).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("authorizes the scheduled cron path via a valid x-archival-token header (Req 6.6)", async () => {
    const N = 3;
    process.env.ARCHIVAL_CRON_SECRET = "s3cret-cron-token";
    requireRole.mockResolvedValueOnce({ ok: false, response: undefined });
    archiveOldRecords.mockResolvedValueOnce({ archivedCount: N });

    const res = await POST(
      makePostRequest({ "x-archival-token": "s3cret-cron-token" })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ archivedCount: N });
    expect(archiveOldRecords).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when archival throws, consistent with rollback semantics (Req 6.8)", async () => {
    requireRole.mockResolvedValueOnce({ ok: true, user: { id: 1, role: "Admin" } });
    archiveOldRecords.mockRejectedValueOnce(new Error("transaction failed"));

    const res = await POST(makePostRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
    // Archival did not complete -> no audit entry recording a successful count.
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
