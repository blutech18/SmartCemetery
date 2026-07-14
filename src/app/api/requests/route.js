import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";
import { REQUEST_SCHEMA, createUniqueReferenceId } from "@/lib/requests";
import {
  createOutcomeNotification,
  isEmailConfigured,
  sendOutcomeEmail,
} from "@/lib/notifications";
import { writeAuditLog, getClientIp } from "@/lib/audit";

// Reference ID generation (crypto) and best-effort email need the Node runtime.
export const runtime = "nodejs";

/**
 * PATCH validation schema — status change to approved/rejected only (Req 9.1).
 * `id` is the numeric Request identifier; `status` is the new outcome.
 */
const STATUS_UPDATE_SCHEMA = {
  id: { required: true, type: "integer" },
  status: { required: true, type: "string", enum: ["approved", "rejected"] },
};

/** Uniform 403 body, matching the authz guard shape. */
function forbidden(message = "Insufficient role permission") {
  return NextResponse.json(
    { error: { type: "forbidden", message } },
    { status: 403 }
  );
}

/**
 * GET /api/requests
 *   - `?ref=<Reference_ID>` — status lookup for any authenticated user:
 *       200 + { referenceId, status, ... } when found (Req 7.5),
 *       404 + error when not (Req 7.6).
 *   - no `ref` — Admin/Staff listing of requests (record management, Req 7),
 *       guarded by requireRole(request, "verify"); optional `?status=` filter.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const referenceId = searchParams.get("ref");

  // Reference lookup — accessible to the requesting client (any authenticated user).
  if (referenceId) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    try {
      // Clients may only inspect their own request. Admin/Staff retain
      // unscoped lookup for request-management assistance.
      const where = auth.user.role === "Client"
        ? { referenceId, userId: Number(auth.user.id) }
        : { referenceId };
      const found = await prisma.request.findFirst({
        where,
        select: {
          id: true,
          referenceId: true,
          type: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!found) {
        return NextResponse.json(
          { error: `No request found for reference ${referenceId}` },
          { status: 404 }
        );
      }

      return NextResponse.json(found);
    } catch (error) {
      console.error("GET /api/requests?ref error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // Authenticated Clients receive only their own requests. Admin/Staff retain
  // the management list, with the same optional status filter.
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const status = searchParams.get("status");
    const where = auth.user.role === "Client"
      ? { userId: Number(auth.user.id) }
      : {};
    if (status) where.status = status;

    const requests = await prisma.request.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET /api/requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/requests — Submit a new request (authenticated Client/Staff/Admin).
 * userId comes from the session, never the body (Req 7.1). Validates type +
 * description (Req 7.2–7.4), creates with status "pending" and a unique
 * referenceId (Req 7.1, 7.7). Returns 201 with the created request.
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = validateBody(body, REQUEST_SCHEMA);
  if (!result.valid) {
    return validationErrorResponse(result.errors);
  }

  const { type, description } = result.value;

  try {
    // Unique Reference_ID with retry-on-collision (Req 7.7).
    const referenceId = await createUniqueReferenceId(prisma);

    const newRequest = await prisma.request.create({
      data: {
        userId: Number(auth.user.id),
        type,
        description,
        status: "pending",
        referenceId,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Best-effort audit AFTER persistence (Req 14).
    await writeAuditLog({
      userId: Number(auth.user.id),
      action: "request.create",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error("POST /api/requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/requests — Change a request's status to approved/rejected.
 * Admin-only (design §9): authenticate via the requests domain then require the
 * Admin role. On a successful change, create an in-app outcome notification
 * (Req 9.1) and, when SMTP is configured, best-effort send an outcome email and
 * record the delivery result on the notification (Req 9.3–9.5) — never blocking
 * the response.
 */
export async function PATCH(request) {
  const auth = await requireRole(request, "request");
  if (!auth.ok) return auth.response;

  // Status changes are Admin-only (design §9).
  if (auth.user.role !== "Admin") {
    return forbidden("Only an Admin can change a request's status");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = validateBody(body, STATUS_UPDATE_SCHEMA);
  if (!result.valid) {
    return validationErrorResponse(result.errors);
  }

  const { id, status } = result.value;

  const changedAt = new Date();
  let updated;
  let notification;
  try {
    const decision = await prisma.$transaction(async (tx) => {
      const existing = await tx.request.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) return { error: "not_found" };
      if (existing.status !== "pending") return { error: "already_decided" };

      const claimed = await tx.request.updateMany({
        where: { id, status: "pending" },
        data: { status },
      });
      if (claimed.count !== 1) return { error: "already_decided" };

      const requestRecord = await tx.request.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      const outcomeNotification = await createOutcomeNotification({
        prisma: tx,
        request: requestRecord,
        outcome: status,
        changedAt,
      });
      return { requestRecord, outcomeNotification };
    });

    if (decision.error === "not_found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (decision.error === "already_decided") {
      return NextResponse.json(
        { error: "Request has already been approved or rejected" },
        { status: 409 }
      );
    }
    updated = decision.requestRecord;
    notification = decision.outcomeNotification;
  } catch (error) {
    console.error("PATCH /api/requests transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Email is optional and best-effort after the atomic in-app decision.
  const ownerEmail = updated.user?.email;
  if (isEmailConfigured() && ownerEmail) {
    try {
      const emailResult = await sendOutcomeEmail(ownerEmail, {
        referenceId: updated.referenceId,
        outcome: status,
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailStatus: emailResult.sent ? "sent" : "failed" },
      });
    } catch (emailError) {
      console.error("PATCH /api/requests email delivery error:", emailError);
      try {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { emailStatus: "failed" },
        });
      } catch {
        /* The required in-app notification is already committed. */
      }
    }
  }

  // Best-effort audit AFTER persistence (Req 14).
  await writeAuditLog({
    userId: Number(auth.user.id),
    action: "request.update",
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(updated);
}
