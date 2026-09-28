const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const latest = await prisma.plot.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { plotNumber: true, updatedAt: true, gpsLat: true, gpsLng: true }
  });
  console.log("10 most recently updated plots:");
  for (const p of latest) {
    console.log(p.plotNumber, p.updatedAt, p.gpsLat, p.gpsLng);
  }

  const allPlots = await prisma.plot.findMany({
    select: {
      id: true,
      plotNumber: true,
      gpsLat: true,
      gpsLng: true,
      locationDetail: { select: { subsection: true } }
    }
  });

  const pinned = allPlots.filter((p) => p.gpsLat !== null);
  console.log(`Total plots in DB: ${allPlots.length}, Pinned: ${pinned.length}`);
}

main().finally(() => prisma.$disconnect());
