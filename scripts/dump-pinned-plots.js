const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const plots = await prisma.plot.findMany({
    where: { locationDetail: { locationId: 4 }, gpsLat: { not: null } },
    select: {
      id: true,
      plotNumber: true,
      gpsLat: true,
      gpsLng: true,
      status: true,
      locationDetail: { select: { id: true, subsection: true } }
    },
    orderBy: [{ locationDetail: { subsection: "asc" } }, { plotNumber: "asc" }]
  });

  const rows = {};
  for (const p of plots) {
    const r = p.locationDetail?.subsection || "OTHER";
    if (!rows[r]) rows[r] = [];
    rows[r].push(p);
  }

  for (const [r, list] of Object.entries(rows)) {
    console.log(`\n=== ROW: ${r} (${list.length} plots) ===`);
    for (const p of list) {
      console.log(`  ${p.plotNumber}: [${Number(p.gpsLat)}, ${Number(p.gpsLng)}] (${p.status})`);
    }
  }
}

main().finally(() => prisma.$disconnect());
