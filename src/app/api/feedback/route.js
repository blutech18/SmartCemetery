import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";

/**
 * Feedback validation schema (Req 8.2, 8.3, 8.4).
 *   - rating: required integer 1–5 inclusive.
 *   - comment: optional string; when present, trimmed length 1–1000.
 */
const feedbackSchema = {
  rating: { required: true, type: "integer", min: 1, max: 5 },
  comment: { type: "string", trim: true, min: 1, max: 1000 },
};

// GET /api/feedback — List all feedback (reporting concern → Admin only, Req 8).
export async function GET(request) {
  const auth = await requireRole(request, "reports");
  if (!auth.ok) return auth.response;

  try {
    const feedbacks = await prisma.feedback.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/feedback — Submit feedback (any authenticated user, Req 8.1, 8.5–8.7).
export async function POST(request) {
  // Require an authenticated user; userId is taken from the session, not the body.
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Validate rating/comment (Req 8.2, 8.3, 8.4). Returns 400 with all failing fields.
  const result = validateBody(body, feedbackSchema);
  if (!result.valid) {
    return validationErrorResponse(result.errors);
  }

  const { rating, comment } = result.value;

  try {
    const feedback = await prisma.feedback.create({
      data: {
        userId: Number(auth.user.id),
        rating,
        comment: comment ?? null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    // Confirmation includes the persisted feedback id (Req 8.6).
    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    // Persistence failure — no partial record is returned (Req 8.7).
    console.error("POST /api/feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
