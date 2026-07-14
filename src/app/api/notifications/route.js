import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";

// Prisma / bcrypt-adjacent work needs the Node.js runtime, not edge.
export const runtime = "nodejs";

/**
 * GET /api/notifications — Request outcome notifications for the current user.
 *
 * Requires an authenticated user (`requireAuth`). Returns that user's own
 * outcome notifications ordered from most recent to oldest by status-change
 * timestamp (Req 9.2). The recipient is taken from the session, never the
 * query string, so a Client can only see their own outcomes.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: Number(auth.user.id) },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const MARK_READ_SCHEMA = {
  id: { required: true, type: "integer" },
};

/** PATCH /api/notifications — mark one owned notification as read. */
export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const validation = validateBody(body, MARK_READ_SCHEMA);
  if (!validation.valid) return validationErrorResponse(validation.errors);

  try {
    const result = await prisma.notification.updateMany({
      where: {
        id: validation.value.id,
        userId: Number(auth.user.id),
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    if (result.count !== 1) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}