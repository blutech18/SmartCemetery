import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { archiveOldRecords } from "@/lib/archival";
import { getClientIp, writeAuditLog } from "@/lib/audit";

// Prisma requires the Node.js runtime.
export const runtime = "nodejs";

/**
 * POST /api/archival — trigger the 5-year Archival_Service (Req 6).
 *
 * Authorization (Req 6.6): the request is accepted when EITHER
 *   - the caller is an authenticated Admin (`requireRole(request, "archival")`), OR
 *   - the request carries a valid scheduled-invocation credential: the
 *     `x-archival-token` header equals `process.env.ARCHIVAL_CRON_SECRET`.
 * Otherwise the request is rejected with 403 and NO grave record is changed.
 *
 * On success it runs `archiveOldRecords` inside a Prisma transaction (rollback
 * on failure — Req 6.8), returns `{ archivedCount }` including zero (Req 6.5),
 * and writes an Audit_Log entry recording the count (Req 6.7).
 *
 * Audit userId note: `UserLog.userId` is a required FK to `users`. For the
 * Admin path we use `user.id`. The cron-token path has no user session, so we
 * fall back to an optional configured system user id (`ARCHIVAL_SYSTEM_USER_ID`)
 * when present; otherwise we record the outcome via a best-effort console log
 * (the audit write is skipped rather than violating the FK).
 */
export async function POST(request) {
  try {
    // Determine authorization: Admin role OR valid cron token.
    const authz = await requireRole(request, "archival");

    let auditUserId = null;
    let authorized = false;

    if (authz.ok) {
      authorized = true;
      auditUserId = authz.user.id;
    } else {
      const cronSecret = process.env.ARCHIVAL_CRON_SECRET;
      const providedToken = request.headers.get("x-archival-token");
      if (cronSecret && providedToken && providedToken === cronSecret) {
        authorized = true;
        // No user session for cron; use configured system user id if available.
        const systemUserId = process.env.ARCHIVAL_SYSTEM_USER_ID;
        auditUserId = systemUserId ? Number(systemUserId) : null;
      }
    }

    if (!authorized) {
      // Reject with 403 and make no changes (Req 6.6).
      return NextResponse.json(
        { error: { type: "forbidden", message: "Archival requires Admin authorization or a valid scheduled-invocation credential" } },
        { status: 403 }
      );
    }

    // Run archival (transactional; rolls back on failure — Req 6.8).
    const now = new Date();
    const { archivedCount } = await archiveOldRecords(prisma, now);

    // Audit after the mutation commits, recording the count (Req 6.7).
    if (auditUserId != null && !Number.isNaN(auditUserId)) {
      await writeAuditLog({
        userId: auditUserId,
        action: `grave.archive:count=${archivedCount}`,
        ipAddress: getClientIp(request),
      });
    } else {
      // Cron path with no resolvable user: best-effort record.
      console.info(
        `[archival] system-triggered archival completed: grave.archive:count=${archivedCount}`
      );
    }

    return NextResponse.json({ archivedCount });
  } catch (error) {
    console.error("POST /api/archival error:", error);
    return NextResponse.json(
      { error: { type: "internal", message: "Archival did not complete" } },
      { status: 500 }
    );
  }
}
