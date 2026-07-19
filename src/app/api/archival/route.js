import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  archiveOldRecords,
  claimArchivalRun,
  completeArchivalRun,
  defaultArchivalRunKey,
  failArchivalRun,
  isValidArchivalRunKey,
} from "@/lib/archival";
import { getClientIp, writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

async function authorizeTrigger(request) {
  const auth = await requireRole(request, "archival");
  if (auth.ok) {
    return { authorized: true, source: "admin", userId: Number(auth.user.id) };
  }

  const expected = process.env.ARCHIVAL_CRON_SECRET;
  const provided = request.headers.get("x-archival-token");
  if (expected && provided && provided === expected) {
    const configuredId = Number.parseInt(process.env.ARCHIVAL_SYSTEM_USER_ID || "", 10);
    return {
      authorized: true,
      source: "cron",
      userId: Number.isInteger(configuredId) ? configuredId : null,
    };
  }
  return { authorized: false };
}

export async function GET(request) {
  const auth = await requireRole(request, "archival");
  if (!auth.ok) return auth.response;

  const parsedLimit = Number.parseInt(new URL(request.url).searchParams.get("limit") || "20", 10);
  const take = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
  try {
    const runs = await prisma.archivalRun.findMany({
      orderBy: { startedAt: "desc" },
      take,
    });
    return NextResponse.json(runs);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  const trigger = await authorizeTrigger(request);
  if (!trigger.authorized) {
    return NextResponse.json(
      { error: { type: "forbidden", message: "Archival requires Admin or scheduled authorization" } },
      { status: 403 }
    );
  }

  const now = new Date();
  const runKey = request.headers.get("x-archival-run-key") || defaultArchivalRunKey(now);
  if (!isValidArchivalRunKey(runKey)) {
    return NextResponse.json(
      { error: { type: "validation", message: "Invalid x-archival-run-key header" } },
      { status: 400 }
    );
  }

  let claim;
  try {
    claim = await claimArchivalRun(prisma, { runKey, source: trigger.source, now });
  } catch {
    return NextResponse.json(
      { error: { type: "internal", message: "Archival run could not be claimed" } },
      { status: 500 }
    );
  }

  if (claim.state === "duplicate") {
    return NextResponse.json({ ...claim.run, duplicate: true });
  }
  if (claim.state === "conflict") {
    return NextResponse.json(
      {
        error: { type: "conflict", message: "An archival run is already in progress" },
        run: claim.run ? { id: claim.run.id, runKey: claim.run.runKey, status: claim.run.status } : null,
      },
      { status: 409 }
    );
  }

  try {
    const result = await archiveOldRecords(prisma, now);
    const run = await completeArchivalRun(prisma, claim.run.id, result.archivedCount);
    if (trigger.userId != null) {
      await writeAuditLog({
        userId: trigger.userId,
        action: `grave.archive:run=${runKey};count=${result.archivedCount}`,
        ipAddress: getClientIp(request),
      });
    }
    return NextResponse.json({ ...run, duplicate: false });
  } catch (error) {
    try {
      await failArchivalRun(prisma, claim.run.id, error);
    } catch {
      // The original failure remains authoritative; do not expose internals.
    }
    console.error("POST /api/archival failed");
    return NextResponse.json(
      { error: { type: "internal", message: "Archival did not complete" }, runKey },
      { status: 500 }
    );
  }
}
