const { PrismaClient } = require("@prisma/client");
const { localOffsetToLatLng } = require("../../src/lib/building-grid");

const prisma = new PrismaClient();

// ARCHIVED destructive script. This rewrites the GPS coordinates of every plot
// in a hardcoded set of sections. Explicit opt-in is required.
if (process.env.CONFIRM_DESTRUCTIVE_SCRIPT !== "yes") {
  console.error(
    "Refusing to run: revise-all-plots.js bulk-rewrites plot GPS coordinates.\n" +
      "Re-run with CONFIRM_DESTRUCTIVE_SCRIPT=yes if you are sure."
  );
  process.exit(1);
}

async function main() {
  const plots = await prisma.plot.findMany({
    where: {
      locationDetailId: { in: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
    },
    orderBy: { plotNumber: "asc" },
  });

  const byRow = {};
  for (const p of plots) {
    const r = p.plotNumber.startsWith("WALAG") ? "ROW-W07" : p.plotNumber.slice(0, 7);
    if (!byRow[r]) byRow[r] = [];
    byRow[r].push(p);
  }

  const updates = [];

  for (const [r, list] of Object.entries(byRow)) {
    list.sort((a, b) => {
      if (a.plotNumber === "WALAG-001") return -1;
      if (b.plotNumber === "WALAG-001") return 1;
      return (a.plotNumber || "").localeCompare(b.plotNumber || "", undefined, { numeric: true });
    });

    const cLat = list.reduce((s, p) => s + Number(p.gpsLat), 0) / list.length;
    const cLng = list.reduce((s, p) => s + Number(p.gpsLng), 0) / list.length;
    const N = list.length;
    const L = N * 2.65;

    for (let i = 0; i < N; i++) {
      const p = list[i];
      const dx = -L / 2 + (i + 0.5) * (L / N);
      const pt = localOffsetToLatLng(dx, 0, cLat, cLng, 37.7);

      updates.push(
        prisma.plot.update({
          where: { id: p.id },
          data: {
            gpsLat: pt.lat,
            gpsLng: pt.lng,
          },
        })
      );
    }
  }

  const result = await prisma.$transaction(updates);
  console.log(`Successfully revised all ${result.length} plots into building blocks!`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
