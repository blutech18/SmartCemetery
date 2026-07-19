/**
 * 5-Year Archival Rule
 * Records stay active for exactly 5 years from burial date.
 * After 5 years, reclassified to "archived" status.
 * Archived records are NEVER deleted — they remain searchable.
 *
 * The DB-backed function receives the Prisma client via dependency injection so
 * this module can be imported (e.g. for testing `shouldArchive`) without a
 * database connection.
 */

const ARCHIVE_YEARS = 5;

/**
 * PURE: compute the archival cutoff — the instant exactly `ARCHIVE_YEARS`
 * years before `now`. A record qualifies when its burial date is strictly
 * before this cutoff (i.e. MORE than five years before `now`).
 *
 * @param {Date} now reference time
 * @returns {Date}
 */
function archivalCutoff(now) {
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - ARCHIVE_YEARS);
  return cutoff;
}

/**
 * PURE: should a record with `burialDate` be archived relative to `now`?
 *
 * Returns true iff `burialDate` is MORE than five years before `now`
 * (strictly before the cutoff) — Req 6.1. Property-testable: accepts an
 * explicit `now` (Date or epoch ms) as a second parameter, defaulting to the
 * current time for backward-compatibility.
 *
 * @param {Date|string|number|null|undefined} burialDate
 * @param {Date|number} [now=new Date()] reference time (Date or ms)
 * @returns {boolean}
 */
export function shouldArchive(burialDate, now = new Date()) {
  if (!burialDate) return false;
  const nowDate = now instanceof Date ? now : new Date(now);
  const cutoff = archivalCutoff(nowDate);
  return new Date(burialDate) < cutoff;
}

/**
 * Reclassify to "archived" every ACTIVE grave whose burial date is more than
 * five years before `now` (Req 6.1). Runs inside a single Prisma transaction so
 * any failure rolls back all reclassifications, leaving no record partially
 * archived (Req 6.8). Sets `archivedAt = now` (Req 6.2) and never deletes
 * records (Req 6.3). Returns `{ archivedCount }`, including 0 when none
 * qualify (Req 6.5).
 *
 * Prisma is dependency-injected as the first parameter (no top-level import).
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {Date} [now=new Date()] reference time
 * @returns {Promise<{ archivedCount: number, cutoffDate: Date, processedAt: Date }>}
 */
export async function archiveOldRecords(prisma, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const cutoffDate = archivalCutoff(nowDate);

  const { count } = await prisma.$transaction(async (tx) => {
    return tx.grave.updateMany({
      where: {
        status: "active",
        burialDate: { lt: cutoffDate },
      },
      data: {
        status: "archived",
        archivedAt: nowDate,
      },
    });
  });

  return {
    archivedCount: count,
    cutoffDate,
    processedAt: nowDate,
  };
}


export function defaultArchivalRunKey(now = new Date()) {
  return `daily:${now.toISOString().slice(0, 10)}`;
}

export function isValidArchivalRunKey(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/.test(value);
}

/** Atomically claim a durable run key while preventing any overlapping run. */
export async function claimArchivalRun(prisma, { runKey, source, now = new Date() }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.archivalRun.findUnique({ where: { runKey } });
      if (existing?.status === "success") return { state: "duplicate", run: existing };
      if (existing?.status === "running") return { state: "conflict", run: existing };

      const overlapping = await tx.archivalRun.findFirst({
        where: { status: "running", ...(existing ? { id: { not: existing.id } } : {}) },
        orderBy: { startedAt: "desc" },
      });
      if (overlapping) return { state: "conflict", run: overlapping };

      if (existing) {
        const claimed = await tx.archivalRun.updateMany({
          where: { id: existing.id, status: "failed" },
          data: {
            status: "running",
            source,
            archivedCount: 0,
            error: null,
            startedAt: now,
            finishedAt: null,
          },
        });
        if (claimed.count !== 1) return { state: "conflict", run: existing };
        return {
          state: "claimed",
          run: await tx.archivalRun.findUnique({ where: { id: existing.id } }),
        };
      }

      return {
        state: "claimed",
        run: await tx.archivalRun.create({
          data: { runKey, source, status: "running", startedAt: now },
        }),
      };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error?.code === "P2002") {
      const run = await prisma.archivalRun.findUnique({ where: { runKey } });
      return { state: run?.status === "success" ? "duplicate" : "conflict", run };
    }
    throw error;
  }
}

export async function completeArchivalRun(prisma, runId, archivedCount, finishedAt = new Date()) {
  return prisma.archivalRun.update({
    where: { id: runId },
    data: { status: "success", archivedCount, error: null, finishedAt },
  });
}

export async function failArchivalRun(prisma, runId, error, finishedAt = new Date()) {
  const safeError = String(error?.message || "Archival failed").slice(0, 500);
  return prisma.archivalRun.update({
    where: { id: runId },
    data: { status: "failed", error: safeError, finishedAt },
  });
}
