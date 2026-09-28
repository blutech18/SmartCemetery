const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const preset = require("../../src/lib/bolonsori-preset.json");

const DELETED_ROWS = ["ROW-W01", "ROW-W02", "ROW-W04"];

// ARCHIVED destructive script. This deletes cemetery rows and seeds fabricated
// burial records with auto-verified status. Never run it against a real
// cemetery database. Explicit opt-in is required.
if (process.env.CONFIRM_DESTRUCTIVE_SCRIPT !== "yes") {
  console.error(
    "Refusing to run: seed-apartment-rows.js deletes cemetery records and seeds fabricated data.\n" +
      "Re-run with CONFIRM_DESTRUCTIVE_SCRIPT=yes only on a disposable database."
  );
  process.exit(1);
}

async function main() {
  console.log("Seeding City Memorial Park (CMP) Apartment Crypt Rows directly from Bolonsiri Master Preset...");

  const { encryptGraveDetail } = await import("../../src/lib/encryption.js");

  // Find admin user for verification
  const admin = await prisma.user.findFirst({
    where: { userType: { typeName: "Admin" } },
  });
  const adminId = admin ? admin.id : null;

  // 1. Create or update City Memorial Park location
  let cmpLocation = await prisma.location.findFirst({
    where: { name: { contains: "City Memorial Park" } },
    include: { details: true },
  });

  if (!cmpLocation) {
    cmpLocation = await prisma.location.create({
      data: {
        name: "City Memorial Park (CMP) - Bolonsiri",
        description: "Public cemetery redevelopment area featuring multi-tier apartment crypts, administrative offices, and memorial rows in Camaman-an, Cagayan de Oro.",
        gpsLat: 8.46571,
        gpsLng: 124.65700,
      },
      include: { details: true },
    });
    console.log("  ✓ Created CMP Location:", cmpLocation.name);
  } else {
    cmpLocation = await prisma.location.update({
      where: { id: cmpLocation.id },
      data: {
        gpsLat: 8.46571,
        gpsLng: 124.65700,
      },
      include: { details: true },
    });
    console.log("  ✓ Updated CMP Location center:", cmpLocation.name);
  }

  const sampleDeceased = [
    { name: "Beatriz Walag", date: "2018-03-20", cause: "Natural Causes / Old Age", kin: "Nimfa Walag (Daughter)" },
    { name: "Nimfa Walag", date: "2021-10-14", cause: "Cardiopulmonary Arrest", kin: "Roberto Walag (Son)" },
    { name: "Ramon Magsaysay V", date: "2019-05-12", cause: "Pneumonia", kin: "Maria Magsaysay" },
    { name: "Teodoro Agoncillo", date: "2020-08-22", cause: "Heart Failure", kin: "Elena Agoncillo" },
    { name: "Marcelo H. Del Pilar II", date: "2017-11-04", cause: "Hypertension", kin: "Sofia Del Pilar" },
    { name: "Clara Recto", date: "2022-01-19", cause: "Chronic Kidney Disease", kin: "Antonio Recto" },
    { name: "Geronimo Berenguer", date: "2019-09-30", cause: "Respiratory Failure", kin: "Lourdes Berenguer" },
    { name: "Corazon Aquino-Santos", date: "2023-04-15", cause: "Cardiac Arrest", kin: "Ferdinand Santos" },
    { name: "Diosdado Macapagal Jr.", date: "2020-12-05", cause: "Complications of Diabetes", kin: "Evangeline Macapagal" },
    { name: "Esteban Rodriguez", date: "2021-07-08", cause: "Myocardial Infarction", kin: "Carmela Rodriguez" },
    { name: "Salvador Laurel III", date: "2018-06-25", cause: "Cerebrovascular Disease", kin: "Beatrice Laurel" },
    { name: "Teresa Magbanua-Cruz", date: "2022-11-18", cause: "Multiple Organ Failure", kin: "Manuel Cruz" },
  ];

  let sampleIdx = 2;
  let totalPlotsSeeded = 0;
  const activePlotNumbers = new Set();

  // 2. Seed all 12 active apartment building rows from preset
  const activeRowKeys = Object.keys(preset.rows);
  for (let rIdx = 0; rIdx < activeRowKeys.length; rIdx++) {
    const rowCode = activeRowKeys[rIdx];
    const rowData = preset.rows[rowCode];

    let sectionDetail = await prisma.locationDetail.findFirst({
      where: {
        locationId: cmpLocation.id,
        subsection: rowCode,
      },
    });

    if (!sectionDetail) {
      sectionDetail = await prisma.locationDetail.create({
        data: {
          locationId: cmpLocation.id,
          subsection: rowCode,
          capacity: rowData.plotCount * 4,
          sortOrder: rIdx + 1,
        },
      });
      console.log(`  ✓ Created Section ${rowCode}`);
    } else {
      await prisma.locationDetail.update({
        where: { id: sectionDetail.id },
        data: {
          capacity: rowData.plotCount * 4,
          sortOrder: rIdx + 1,
        },
      });
    }

    for (let pIdx = 0; pIdx < rowData.plots.length; pIdx++) {
      const pDef = rowData.plots[pIdx];
      activePlotNumbers.add(pDef.plotNumber);

      const isWalagGrave = pDef.plotNumber === "WALAG-001";
      const status = pDef.status || "available";

      let plot = await prisma.plot.findFirst({
        where: {
          locationDetailId: sectionDetail.id,
          plotNumber: pDef.plotNumber,
        },
        include: { graves: { include: { details: true } } },
      });

      if (!plot) {
        plot = await prisma.plot.create({
          data: {
            locationDetailId: sectionDetail.id,
            plotNumber: pDef.plotNumber,
            status,
            gpsLat: pDef.lat,
            gpsLng: pDef.lng,
          },
          include: { graves: { include: { details: true } } },
        });
        totalPlotsSeeded++;
      } else {
        plot = await prisma.plot.update({
          where: { id: plot.id },
          data: {
            gpsLat: pDef.lat,
            gpsLng: pDef.lng,
            status,
          },
          include: { graves: { include: { details: true } } },
        });
      }

      // If Walag Grave, ensure exact 4-tier stack data
      if (isWalagGrave && (!plot.graves || plot.graves.length === 0)) {
        const walagTiers = [
          {
            tier: 1,
            label: "Tier 1 (Ground Level)",
            deceasedName: "Beatriz Walag",
            burialDate: "2018-03-20T00:00:00.000Z",
            deathDate: "2018-03-16",
            causeOfDeath: "Natural Causes / Old Age (Age: 84)",
            contactPerson: "Nimfa Walag (Daughter)",
            contactPhone: "+63 917 555 0192",
            status: "occupied",
            notes: "Beloved mother and grandmother. Resting in peace with daughter Nimfa.",
          },
          {
            tier: 2,
            label: "Tier 2 (Second Level)",
            deceasedName: "Nimfa Walag",
            burialDate: "2021-10-14T00:00:00.000Z",
            deathDate: "2021-10-10",
            causeOfDeath: "Cardiopulmonary Arrest (Age: 62)",
            contactPerson: "Roberto Walag (Son)",
            contactPhone: "+63 918 333 4455",
            status: "occupied",
            notes: "Cherished educator, mother, and sister. Forever remembered.",
          },
          {
            tier: 3,
            label: "Tier 3 (Third Level)",
            status: "available",
            notes: "Reserved for family member.",
          },
          {
            tier: 4,
            label: "Tier 4 (Top Level)",
            status: "available",
            notes: "Unoccupied apartment niche crypt.",
          },
        ];

        const notesContent = JSON.stringify({
          type: "apartment_niche_stack",
          structureName: "Beatriz and Nimfa Walag Grave",
          totalTiers: 4,
          occupiedCount: 2,
          availableCount: 2,
          tiers: walagTiers,
        });

        await prisma.grave.create({
          data: {
            plotId: plot.id,
            deceasedName: "Beatriz and Nimfa Walag",
            burialDate: new Date("2021-10-14"),
            status: "active",
            verificationStatus: "verified",
            verifiedAt: new Date(),
            verifiedById: adminId,
            verificationNote: "Verified family multi-tier apartment crypt (Beatriz Walag - Tier 1, Nimfa Walag - Tier 2)",
            details: {
              create: encryptGraveDetail({
                causeOfDeath: "Tier 1: Natural Causes | Tier 2: Cardiopulmonary Arrest",
                contactPerson: "Roberto Walag (Family Representative)",
                contactPhone: "+63 918 333 4455",
                notes: notesContent,
              }),
            },
          },
        });
        console.log(`  ★ Seeded Beatriz and Nimfa Walag Grave (WALAG-001) at (${pDef.lat}, ${pDef.lng})!`);
      } else if (!isWalagGrave && plot.status === "occupied" && (!plot.graves || plot.graves.length === 0)) {
        const dec1 = sampleDeceased[sampleIdx % sampleDeceased.length];
        sampleIdx++;
        const dec2 = (pIdx % 2 === 0) ? sampleDeceased[sampleIdx % sampleDeceased.length] : null;
        if (dec2) sampleIdx++;

        const tiers = [
          {
            tier: 1,
            label: "Tier 1 (Ground Level)",
            deceasedName: dec1.name,
            burialDate: `${dec1.date}T00:00:00.000Z`,
            causeOfDeath: dec1.cause,
            contactPerson: dec1.kin,
            status: "occupied",
          },
          {
            tier: 2,
            label: "Tier 2 (Second Level)",
            deceasedName: dec2 ? dec2.name : null,
            burialDate: dec2 ? `${dec2.date}T00:00:00.000Z` : null,
            causeOfDeath: dec2 ? dec2.cause : null,
            contactPerson: dec2 ? dec2.kin : null,
            status: dec2 ? "occupied" : "available",
          },
          {
            tier: 3,
            label: "Tier 3 (Third Level)",
            status: "available",
          },
          {
            tier: 4,
            label: "Tier 4 (Top Level)",
            status: "available",
          },
        ];

        const notesContent = JSON.stringify({
          type: "apartment_niche_stack",
          structureName: `${rowCode} Column ${pIdx + 1} Crypt`,
          totalTiers: 4,
          occupiedCount: dec2 ? 2 : 1,
          availableCount: dec2 ? 2 : 3,
          tiers,
        });

        await prisma.grave.create({
          data: {
            plotId: plot.id,
            deceasedName: dec2 ? `${dec1.name} & ${dec2.name}` : dec1.name,
            burialDate: new Date(dec1.date),
            status: "active",
            verificationStatus: "verified",
            verifiedAt: new Date(),
            verifiedById: adminId,
            verificationNote: "Verified cemetery municipal record (Apartment Crypt)",
            details: {
              create: encryptGraveDetail({
                causeOfDeath: dec1.cause,
                contactPerson: dec1.kin,
                contactPhone: "+63 917 555 " + String(1000 + sampleIdx).slice(1),
                notes: notesContent,
              }),
            },
          },
        });
      }
    }
  }

  // 3. Handle Deleted Rows (ROW-W01, ROW-W02, ROW-W04)
  for (const delRow of DELETED_ROWS) {
    const detail = await prisma.locationDetail.findFirst({
      where: { locationId: cmpLocation.id, subsection: delRow },
      include: { plots: { include: { graves: true } } },
    });
    if (detail) {
      for (const p of detail.plots) {
        if (p.graves && p.graves.length > 0) {
          // Unpin occupied plot to unplaced list
          await prisma.plot.update({
            where: { id: p.id },
            data: { gpsLat: null, gpsLng: null },
          });
        } else {
          // Delete empty plot
          await prisma.plot.delete({ where: { id: p.id } });
        }
      }
    }
  }

  // 4. Clean up any excess empty plots from active rows that are not in the preset
  const allPlotsInCMP = await prisma.plot.findMany({
    where: { locationDetail: { locationId: cmpLocation.id }, gpsLat: { not: null } },
    include: { graves: true },
  });

  for (const p of allPlotsInCMP) {
    if (!activePlotNumbers.has(p.plotNumber)) {
      if (p.graves && p.graves.length > 0) {
        await prisma.plot.update({
          where: { id: p.id },
          data: { gpsLat: null, gpsLng: null },
        });
      } else {
        await prisma.plot.delete({ where: { id: p.id } });
      }
    }
  }

  console.log(`\n✅ Finished applying Bolonsiri Master Preset!`);
  console.log(`  ✓ 12 Active Apartment Rows seeded (${activePlotNumbers.size} plots positioned)`);
  console.log(`  ✓ Clean foundations ROW-W01, ROW-W02, ROW-W04 safely unpinned.`);
}

main().finally(() => prisma.$disconnect());
