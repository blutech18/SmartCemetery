const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

async function main() {
  const plots = await prisma.plot.findMany({
    where: { locationDetail: { locationId: 4 } },
    select: {
      id: true,
      plotNumber: true,
      gpsLat: true,
      gpsLng: true,
      status: true,
      locationDetail: { select: { id: true, subsection: true } },
      graves: {
        select: {
          id: true,
          deceasedName: true,
          burialDate: true
        }
      }
    },
    orderBy: [{ locationDetail: { subsection: "asc" } }, { plotNumber: "asc" }]
  });

  console.log(`Found ${plots.length} total plots in CMP.`);
  const pinnedPlots = plots.filter((p) => p.gpsLat !== null);
  const unpinnedPlots = plots.filter((p) => p.gpsLat === null);
  console.log(`Pinned: ${pinnedPlots.length}, Unpinned: ${unpinnedPlots.length}`);

  // Calculate building parameters for each row
  const rows = {};
  for (const p of pinnedPlots) {
    const rowKey = p.locationDetail?.subsection || p.plotNumber.slice(0, 7);
    if (!rows[rowKey]) rows[rowKey] = [];
    rows[rowKey].push({
      plotNumber: p.plotNumber,
      lat: Number(p.gpsLat),
      lng: Number(p.gpsLng),
      status: p.status,
      hasGraves: p.graves?.length > 0
    });
  }

  const presetData = {
    name: "Bolonsiri Concrete Apartments (Current Localdev Design)",
    description: "Exact plot layout and crypt positions aligned with drone/satellite concrete foundations.",
    totalPlots: pinnedPlots.length,
    rows: {}
  };

  for (const [r, list] of Object.entries(rows)) {
    const lats = list.map((p) => p.lat);
    const lngs = list.map((p) => p.lng);
    const centerLat = Number((lats.reduce((a, b) => a + b, 0) / list.length).toFixed(8));
    const centerLng = Number((lngs.reduce((a, b) => a + b, 0) / list.length).toFixed(8));

    presetData.rows[r] = {
      rowKey: r,
      plotCount: list.length,
      centerLat,
      centerLng,
      plots: list
    };
  }

  const exportPath = path.join(__dirname, "../src/lib/bolonsori-preset.json");
  fs.writeFileSync(exportPath, JSON.stringify(presetData, null, 2), "utf8");
  console.log(`Exported preset data to ${exportPath}`);
}

main().finally(() => prisma.$disconnect());
