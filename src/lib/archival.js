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
