/**
 * Remove duplicate copies of the demo sections left behind by earlier seed runs.
 *
 *   npm run db:cleanup-demo                          # dry run: prints the plan, writes nothing
 *   npm run db:cleanup-demo -- --apply               # performs it (any shell)
 *   CLEANUP_CONFIRM=apply npm run db:cleanup-demo    # same, Bash only; PowerShell: $env:CLEANUP_CONFIRM="apply"
 *
 * Older versions of the seed created the demo sections (Section A/B/C) again on
 * every run, so plots like "A1-009" appear several times. This keeps the OLDEST
 * copy of each demo location and deletes the newer ones.
 *
 * Safety:
 *  - only the demo locations named in src/lib/demo-data.js are ever considered;
 *  - a copy is removed only when EVERY grave in it has an invented demo name. A
 *    copy that holds anything that could be a real record is reported and left
 *    untouched (exit code 1);
 *  - each copy is removed in its own transaction;
 *  - re-running it is harmless.
 */
const { PrismaClient } = require("@prisma/client");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply") || process.env.CLEANUP_CONFIRM === "apply";

async function main() {
  const { DEMO_LOCATION_NAMES, planDemoCleanup } = await import("../src/lib/demo-data.js");
  console.log(apply ? "MODE: APPLY" : "MODE: dry run (add -- --apply to delete: npm run db:cleanup-demo -- --apply)");

  const rows = await prisma.location.findMany({
    where: { name: { in: DEMO_LOCATION_NAMES } },
    select: {
      id: true,
      name: true,
      details: {
        select: { plots: { select: { id: true, graves: { select: { id: true, deceasedName: true } } } } },
      },
    },
  });
  const locations = rows.map((l) => ({ id: l.id, name: l.name, plots: l.details.flatMap((d) => d.plots) }));
  const plan = planDemoCleanup(locations);

  for (const k of plan.keep) console.log(`keep   #${k.id} ${k.name}`);
  for (const r of plan.remove) {
    console.log(`remove #${r.id} ${r.name}: ${r.plotIds.length} plots, ${r.graveIds.length} demo graves`);
  }
  for (const b of plan.blocked) {
    console.warn(`SKIP   #${b.id} ${b.name}: has records that look real (${b.realNames.join(", ")}) — left untouched`);
  }

  if (plan.remove.length === 0) {
    console.log("\nNothing to remove.");
  } else if (!apply) {
    console.log(`\nDry run only — ${plan.remove.length} duplicate location(s) would be removed. Nothing was written.`);
  } else {
    for (const r of plan.remove) {
      await prisma.$transaction(async (tx) => {
        if (r.graveIds.length) await tx.grave.deleteMany({ where: { id: { in: r.graveIds } } }); // details cascade
        if (r.plotIds.length) await tx.plot.deleteMany({ where: { id: { in: r.plotIds } } }); // photos cascade
        await tx.locationDetail.deleteMany({ where: { locationId: r.id } });
        await tx.location.delete({ where: { id: r.id } });
      });
      console.log(`removed #${r.id} ${r.name}`);
    }
    console.log(`\nRemoved ${plan.remove.length} duplicate location(s).`);
  }

  if (plan.blocked.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
