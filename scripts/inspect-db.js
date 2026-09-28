const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const locations = await prisma.location.findMany({
    include: {
      details: {
        include: {
          plots: {
            take: 5,
            include: {
              graves: true
            }
          }
        }
      }
    }
  });
  console.log("Locations count:", locations.length);
  for (const loc of locations) {
    console.log(`Location: ${loc.name} (id: ${loc.id}, gps: ${loc.gpsLat}, ${loc.gpsLng})`);
    for (const d of loc.details) {
      console.log(`  Detail id: ${d.id}, subsection: ${d.subsection}, capacity: ${d.capacity}, plotsCount: ${d.plots.length}`);
      for (const p of d.plots) {
        console.log(`    Plot: ${p.plotNumber} (id: ${p.id}, status: ${p.status}, gps: ${p.gpsLat}, ${p.gpsLng}), graves: ${p.graves.map(g => g.deceasedName).join(', ')}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
