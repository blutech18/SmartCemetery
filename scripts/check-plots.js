const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const locations = await prisma.location.findMany({
    include: { details: { include: { plots: true } } },
  });
  for (const loc of locations) {
    const totalPlots = loc.details.reduce((sum, d) => sum + d.plots.length, 0);
    console.log(loc.id, loc.name, "plots:", totalPlots);
    for (const d of loc.details) {
      if (d.plots.length > 0) {
        console.log("   - Detail:", d.id, d.subsection, "plots:", d.plots.length);
      }
    }
  }
}

run().finally(() => prisma.$disconnect());
