/**
 * Read-only summary of the cemetery layout in the configured database.
 *
 *   npm run db:inspect                      # every location
 *   npm run db:inspect -- "Location name"   # locations whose name contains the text
 *
 * For each location: its sections (rows) with plot, pinned, tier and grave
 * counts. Writes nothing.
 */
const { PrismaClient } = require("@prisma/client");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

async function main() {
  const filter = (process.argv[2] || "").trim();
  const locations = await prisma.location.findMany({
    where: filter ? { name: { contains: filter } } : undefined,
    orderBy: { id: "asc" },
    include: {
      details: {
        orderBy: { sortOrder: "asc" },
        include: {
          plots: {
            select: { gpsLat: true, totalTiers: true, _count: { select: { graves: true } } },
          },
        },
      },
    },
  });

  if (locations.length === 0) {
    console.log(filter ? `No location matches "${filter}".` : "No locations found.");
    return;
  }

  for (const loc of locations) {
    const plots = loc.details.flatMap((d) => d.plots);
    const pinned = plots.filter((p) => p.gpsLat !== null).length;
    console.log(`\n#${loc.id} ${loc.name}  (${plots.length} plots, ${pinned} pinned)`);
    for (const d of loc.details) {
      const pinnedHere = d.plots.filter((p) => p.gpsLat !== null).length;
      const tiers = [...new Set(d.plots.map((p) => p.totalTiers))].join("/") || "-";
      const graves = d.plots.reduce((n, p) => n + p._count.graves, 0);
      console.log(
        `  ${d.subsection.padEnd(14)} plots ${String(d.plots.length).padStart(3)}  pinned ${String(pinnedHere).padStart(3)}  tiers ${tiers.padEnd(4)}  graves ${graves}`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
