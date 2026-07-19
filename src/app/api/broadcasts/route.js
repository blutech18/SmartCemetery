import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { createAndDeliverBroadcast } from "@/lib/broadcasts";
import { validateBody, validationErrorResponse } from "@/lib/validation";

export const runtime = "nodejs";

const BROADCAST_SCHEMA = {
  audience: { required: true, type: "string", enum: ["All", "Admin", "Staff", "Client"] },
  title: { required: true, type: "string", trim: true, min: 1, max: 160 },
  message: { required: true, type: "string", trim: true, min: 1, max: 10000 },
};

export async function GET(request) {
  const auth = await requireRole(request, "broadcasts");
  if (!auth.ok) return auth.response;

  try {
    const rows = await prisma.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        creator: { select: { name: true } },
        deliveries: { select: { emailStatus: true } },
      },
    });
    return NextResponse.json(rows.map(({ deliveries, ...broadcast }) => ({
      ...broadcast,
      deliveryCounts: deliveries.reduce((counts, delivery) => {
        const key = delivery.emailStatus || "none";
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
      recipientCount: deliveries.length,
    })));
  } catch (error) {
    console.error("GET /api/broadcasts failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireRole(request, "broadcasts");
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const validation = validateBody(body, BROADCAST_SCHEMA);
  if (!validation.valid) return validationErrorResponse(validation.errors);

  try {
    const result = await createAndDeliverBroadcast({
      prisma,
      creatorId: Number(auth.user.id),
      ...validation.value,
    });
    await writeAuditLog({
      userId: Number(auth.user.id),
      action: `broadcast.create:id=${result.id};audience=${result.audience};recipients=${result.recipients}`,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/broadcasts failed");
    return NextResponse.json(
      { error: { type: "internal", message: "Broadcast could not be completed" } },
      { status: 500 }
    );
  }
}
