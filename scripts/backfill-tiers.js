/**
 * Backfill normalized tier/photo data from legacy `notes` JSON.
 *
 *   npm run db:backfill-tiers                       # dry run (default), prints the plan
 *   npm run db:backfill-tiers -- --apply             # applies it (any shell)
 *   BACKFILL_CONFIRM=apply npm run db:backfill-tiers # same, Bash only; PowerShell: $env:BACKFILL_CONFIRM="apply"
 *
 * Back up the database first. Each plot is processed in its own transaction, so
 * a failure on one plot leaves the others (and that plot) untouched. The script
 * is idempotent: already-normalized plots produce an empty plan.
 *
 * Decryption here is STRICT. If any sensitive field of a plot's graves cannot
 * be decrypted (wrong key, corrupt value) the plot is skipped and reported —
 * never treated as empty — so a key problem can't cause data loss.
 */
import { PrismaClient } from "@prisma/client";
import {
  decryptField,
  encryptGraveDetail,
  getCurrentKeyVersion,
} from "../src/lib/encryption.js";
import { planPlotBackfill } from "../src/lib/legacy-notes.js";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply") || process.env.BACKFILL_CONFIRM === "apply";

function decryptDetails(details) {
  if (!details) return null;
  const v = details.encryptionKeyVersion || "v1";
  return {
    causeOfDeath: decryptField(details.causeOfDeath ?? null, v),
    contactPerson: decryptField(details.contactPerson ?? null, v),
    contactPhone: decryptField(details.contactPhone ?? null, v),
    notes: details.notes
      ? details.notesEncrypted
        ? decryptField(details.notes, v)
        : details.notes
      : null,
  };
}

function encryptedColumns(details) {
  const enc = encryptGraveDetail({
    causeOfDeath: details?.causeOfDeath ?? null,
    contactPerson: details?.contactPerson ?? null,
    contactPhone: details?.contactPhone ?? null,
    notes: details?.notes ?? null,
  });
  return {
    causeOfDeath: enc.causeOfDeath,
    contactPerson: enc.contactPerson,
    contactPhone: enc.contactPhone,
    notes: enc.notes,
    notesEncrypted: enc.notesEncrypted,
    encryptionKeyVersion: enc.encryptionKeyVersion,
  };
}

async function applyPlan(plot, plan) {
  await prisma.$transaction(async (tx) => {
    for (const id of plan.graveDeletes) {
      await tx.grave.delete({ where: { id } }); // grave_details cascade
    }
    for (const u of plan.graveUpdates) {
      await tx.grave.update({ where: { id: u.id }, data: u.data });
      if (u.details) {
        const cols = encryptedColumns(u.details);
        await tx.graveDetail.upsert({
          where: { graveId: u.id },
          create: { graveId: u.id, ...cols },
          update: cols,
        });
      }
    }
    for (const c of plan.graveCreates) {
      const created = await tx.grave.create({ data: { ...c.data, tier: c.tier } });
      if (c.details) {
        await tx.graveDetail.create({
          data: { graveId: created.id, ...encryptedColumns(c.details) },
        });
      }
    }
    for (const p of plan.photos) {
      await tx.plotPhoto.upsert({
        where: { plotId_tier: { plotId: plot.id, tier: p.tier } },
        create: { plotId: plot.id, tier: p.tier, url: p.url },
        update: {},
      });
    }
    if (plan.totalTiers !== null) {
      await tx.plot.update({ where: { id: plot.id }, data: { totalTiers: plan.totalTiers } });
    }
  });
}

async function main() {
  getCurrentKeyVersion(); // fail fast on a bad key version
  console.log(apply ? "MODE: APPLY" : "MODE: dry run (add -- --apply to write: npm run db:backfill-tiers -- --apply)");

  const totals = { plots: 0, changed: 0, skipped: 0, deletes: 0, updates: 0, creates: 0, photos: 0 };
  let cursor = 0;

  while (true) {
    const plots = await prisma.plot.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: 50,
      include: {
        photos: { select: { tier: true } },
        graves: { include: { details: true } },
      },
    });
    if (plots.length === 0) break;

    for (const row of plots) {
      cursor = row.id;
      totals.plots += 1;

      let plan;
      try {
        plan = planPlotBackfill({
          id: row.id,
          plotNumber: row.plotNumber,
          totalTiers: row.totalTiers,
          photos: row.photos,
          graves: row.graves.map((g) => ({ ...g, details: decryptDetails(g.details) })),
        });
      } catch (err) {
        totals.skipped += 1;
        console.warn(`SKIP plot ${row.id} (${row.plotNumber}): ${err?.name || "error"} — ${err?.message}`);
        continue;
      }
      if (!plan.changed) continue;

      totals.changed += 1;
      totals.deletes += plan.graveDeletes.length;
      totals.updates += plan.graveUpdates.length;
      totals.creates += plan.graveCreates.length;
      totals.photos += plan.photos.length;
      console.log(
        `plot ${row.id} ${row.plotNumber}: tiers→${plan.totalTiers ?? row.totalTiers}, ` +
          `+${plan.graveCreates.length} graves, ~${plan.graveUpdates.length} updated, ` +
          `-${plan.graveDeletes.length} removed, ${plan.photos.length} photos`
      );

      if (apply) {
        try {
          await applyPlan(row, plan);
        } catch (err) {
          totals.skipped += 1;
          console.error(`FAILED plot ${row.id} (${row.plotNumber}), rolled back: ${err?.message}`);
        }
      }
    }
  }

  console.log("\nSummary:", totals);
  if (!apply && totals.changed > 0) console.log("Dry run only — nothing was written.");
  if (totals.skipped > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
