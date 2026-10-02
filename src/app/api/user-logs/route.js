import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { isValidCategory } from "@/lib/user-log";

export const runtime = "nodejs";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;
const MAX_QUERY_LENGTH = 100;

function intParam(value, fallback, min, max) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function dateParam(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/user-logs — Admin-only view of the audit trail (`user_logs`).
 *
 * Query: page, limit (≤100), q (action, IP, user name or email), category
 * (e.g. "grave"), userId, from / to (ISO timestamps, inclusive).
 */
export async function GET(request) {
  const auth = await requireRole(request, "userLogs");
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const page = intParam(sp.get("page"), 1, 1, 100000);
    const limit = intParam(sp.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const q = (sp.get("q") || "").trim().slice(0, MAX_QUERY_LENGTH);
    const category = sp.get("category") || "";
    const userId = intParam(sp.get("userId"), 0, 0, Number.MAX_SAFE_INTEGER);
    const from = dateParam(sp.get("from"));
    const to = dateParam(sp.get("to"));

    if (category && !isValidCategory(category)) {
      return NextResponse.json(
        { error: { type: "validation", message: "Invalid category" } },
        { status: 400 }
      );
    }

    const where = {};
    if (userId) where.userId = userId;
    if (category) where.action = { startsWith: `${category}.` };
    if (from || to) {
      where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }
    if (q) {
      where.OR = [
        { action: { contains: q } },
        { ipAddress: { contains: q } },
        { user: { is: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } } },
      ];
    }

    const [rows, total, categoryRows] = await Promise.all([
      prisma.userLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, userType: { select: { typeName: true } } } },
        },
      }),
      prisma.userLog.count({ where }),
      // Distinct categories for the filter dropdown (text before the first dot).
      prisma.$queryRaw`SELECT DISTINCT SUBSTRING_INDEX(action, '.', 1) AS category FROM user_logs`,
    ]);

    return NextResponse.json({
      logs: rows.map((r) => ({
        id: r.id,
        action: r.action,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
        user: r.user
          ? { id: r.user.id, name: r.user.name, email: r.user.email, role: r.user.userType?.typeName ?? null }
          : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      categories: categoryRows
        .map((c) => c.category)
        .filter((c) => isValidCategory(c))
        .sort(),
    });
  } catch (error) {
    console.error("GET /api/user-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
