const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Smart Cemetery database...\n");

  // Load the ESM encryption helper so sensitive GraveDetail fields are stored
  // encrypted at rest (matching the API write path). Dynamic import bridges
  // this CommonJS seed to the ESM module.
  const { encryptGraveDetail } = await import("../src/lib/encryption.js");

  // 1. Create User Types
  console.log("Creating user types...");
  const userTypes = await Promise.all([
    prisma.userType.upsert({
      where: { typeName: "Admin" },
      update: {},
      create: { typeName: "Admin" },
    }),
    prisma.userType.upsert({
      where: { typeName: "Staff" },
      update: {},
      create: { typeName: "Staff" },
    }),
    prisma.userType.upsert({
      where: { typeName: "Client" },
      update: {},
      create: { typeName: "Client" },
    }),
  ]);
  console.log(`  ✓ ${userTypes.length} user types created`);

  // 2. Create explicitly configured users. Seed passwords are never embedded
  // in source or printed; this command fails closed when they are absent.
  console.log("Creating configured users...");
  const userSpecs = [
    {
      roleIndex: 0,
      name: "System Administrator",
      email: process.env.SEED_ADMIN_EMAIL || "admin@cemetery.gov.ph",
      password: process.env.SEED_ADMIN_PASSWORD,
    },
    {
      roleIndex: 1,
      name: "Cemetery Staff",
      email: process.env.SEED_STAFF_EMAIL || "staff@cemetery.gov.ph",
      password: process.env.SEED_STAFF_PASSWORD,
    },
    {
      roleIndex: 2,
      name: "Cemetery Client",
      email: process.env.SEED_CLIENT_EMAIL || "visitor@example.com",
      password: process.env.SEED_CLIENT_PASSWORD,
    },
  ];
  for (const spec of userSpecs) {
    if (typeof spec.password !== "string" || spec.password.length < 12) {
      throw new Error("SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD, and SEED_CLIENT_PASSWORD must each contain at least 12 characters");
    }
  }

  const users = await Promise.all(userSpecs.map(async (spec) => {
    const passwordHash = await bcrypt.hash(spec.password, 12);
    return prisma.user.upsert({
      where: { email: spec.email },
      update: {
        name: spec.name,
        passwordHash,
        userTypeId: userTypes[spec.roleIndex].id,
        status: "active",
      },
      create: {
        name: spec.name,
        email: spec.email,
        passwordHash,
        userTypeId: userTypes[spec.roleIndex].id,
        status: "active",
      },
    });
  }));
  console.log(`  ✓ ${users.length} configured users created or updated`);

  // 3. Create Locations
  console.log("Creating locations...");
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        name: "Section A - North Wing",
        description: "Main entrance area, well-maintained section with paved pathways",
        gpsLat: 8.4650,
        gpsLng: 124.6578,
        details: {
          create: [
            { subsection: "A1", sortOrder: 1, capacity: 50 },
            { subsection: "A2", sortOrder: 2, capacity: 50 },
            { subsection: "A3", sortOrder: 3, capacity: 40 },
          ],
        },
      },
      include: { details: true },
    }),
    prisma.location.create({
      data: {
        name: "Section B - East Side",
        description: "Recently expanded section near the chapel",
        gpsLat: 8.4645,
        gpsLng: 124.6582,
        details: {
          create: [
            { subsection: "B1", sortOrder: 1, capacity: 60 },
            { subsection: "B2", sortOrder: 2, capacity: 45 },
          ],
        },
      },
      include: { details: true },
    }),
    prisma.location.create({
      data: {
        name: "Section C - South Garden",
        description: "Garden memorial area with landscaped surroundings",
        gpsLat: 8.4642,
        gpsLng: 124.6575,
        details: {
          create: [
            { subsection: "C1", sortOrder: 1, capacity: 30 },
            { subsection: "C2", sortOrder: 2, capacity: 35 },
          ],
        },
      },
      include: { details: true },
    }),
  ]);
  console.log(`  ✓ ${locations.length} locations created`);

  // 4. Create Plots
  console.log("Creating plots...");
  let plotCount = 0;
  for (const location of locations) {
    for (const detail of location.details) {
      const numPlots = Math.min(detail.capacity, 10); // Create 10 sample plots per subsection
      for (let i = 1; i <= numPlots; i++) {
        const status = i <= 6 ? "occupied" : i <= 8 ? "reserved" : "available";
        await prisma.plot.create({
          data: {
            locationDetailId: detail.id,
            plotNumber: `${detail.subsection}-${String(i).padStart(3, "0")}`,
            status,
            gpsLat: Number(location.gpsLat) + (Math.random() - 0.5) * 0.001,
            gpsLng: Number(location.gpsLng) + (Math.random() - 0.5) * 0.001,
          },
        });
        plotCount++;
      }
    }
  }
  console.log(`  ✓ ${plotCount} plots created`);

  // 5. Create Graves
  console.log("Creating grave records...");
  const occupiedPlots = await prisma.plot.findMany({
    where: { status: "occupied", graves: { none: {} } },
    take: 30,
  });

  const sampleNames = [
    "Jose Rizal", "Andres Bonifacio", "Emilio Aguinaldo",
    "Apolinario Mabini", "Gregorio Del Pilar", "Antonio Luna",
    "Melchora Aquino", "Gabriela Silang", "Diego Silang",
    "Juan Luna", "Felix Resurreccion Hidalgo", "Marcelo H. Del Pilar",
    "Graciano Lopez Jaena", "Lapu-Lapu", "Sultan Kudarat",
    "Datu Puti", "Raja Sulayman", "Pedro Calungsod",
    "Lorenzo Ruiz", "Josefa Llanes Escoda", "Rosa Sevilla",
    "Trinidad Tecson", "Tandang Sora", "Heneral Malvar",
    "Vicente Lim", "Leon Kilat", "Francisco Dagohoy",
    "Rajah Humabon", "Carlos P. Garcia", "Ramon Magsaysay",
  ];

  for (let i = 0; i < occupiedPlots.length && i < sampleNames.length; i++) {
    const yearsAgo = Math.floor(Math.random() * 8) + 1;
    const burialDate = new Date();
    burialDate.setFullYear(burialDate.getFullYear() - yearsAgo);
    burialDate.setMonth(Math.floor(Math.random() * 12));

    const grave = await prisma.grave.create({
      data: {
        plotId: occupiedPlots[i].id,
        deceasedName: sampleNames[i],
        burialDate,
        status: yearsAgo > 5 ? "archived" : "active",
        archivedAt: yearsAgo > 5 ? new Date() : null,
      },
    });

    // Add encrypted operational details for some graves.
    if (i % 2 === 0) {
      const encrypted = encryptGraveDetail({
        causeOfDeath: "Natural causes",
        contactPerson: `Family of ${sampleNames[i]}`,
        contactPhone: `+63 9${Math.floor(100000000 + Math.random() * 900000000)}`,
        notes: "Well-maintained plot with regular family visits.",
      });
      await prisma.graveDetail.create({
        data: {
          graveId: grave.id,
          causeOfDeath: encrypted.causeOfDeath,
          contactPerson: encrypted.contactPerson,
          contactPhone: encrypted.contactPhone,
          notes: encrypted.notes,
          encryptionKeyVersion: encrypted.encryptionKeyVersion,
          notesEncrypted: encrypted.notesEncrypted,
        },
      });
    }
  }
  console.log(`  ✓ ${Math.min(occupiedPlots.length, sampleNames.length)} grave records created`);

  // 6. Create Sample Requests
  console.log("Creating sample requests...");
  await Promise.all([
    prisma.request.upsert({
      where: { referenceId: "REQ-SAMPLE-001" },
      update: { userId: users[2].id },
      create: {
        userId: users[2].id,
        type: "reservation",
        description: "Requesting plot reservation in Section A for upcoming family burial.",
        status: "pending",
        referenceId: "REQ-SAMPLE-001",
      },
    }),
    prisma.request.upsert({
      where: { referenceId: "REQ-SAMPLE-002" },
      update: { userId: users[2].id },
      create: {
        userId: users[2].id,
        type: "record_update",
        description: "Please update the contact information for grave record in plot A1-003.",
        status: "approved",
        referenceId: "REQ-SAMPLE-002",
      },
    }),
  ]);
  console.log("  ✓ 2 sample requests created");

  // 7. Create Sample Feedback
  console.log("Creating sample feedback...");
  await Promise.all([
    prisma.feedback.create({
      data: { userId: users[2].id, rating: 5, comment: "Excellent navigation system! Found the grave location easily." },
    }),
    prisma.feedback.create({
      data: { userId: users[2].id, rating: 4, comment: "Very useful app. Directions were clear and accurate." },
    }),
    prisma.feedback.create({
      data: { userId: users[2].id, rating: 4, comment: "Great improvement over the old paper-based system." },
    }),
  ]);
  console.log("  ✓ 3 sample feedbacks created");

  // 8. Create City Memorial Park (CMP) - Bolonsiri and Apartment Rows from Master Preset
  console.log("Creating City Memorial Park (CMP) - Bolonsiri and apartment rows from Master Preset...");
  const preset = require("../src/lib/bolonsori-preset.json");
  let cmpLocation = await prisma.location.findFirst({
    where: { name: { contains: "City Memorial Park" } },
  });
  if (!cmpLocation) {
    cmpLocation = await prisma.location.create({
      data: {
        name: "City Memorial Park (CMP) - Bolonsiri",
        description: "Public cemetery redevelopment area featuring multi-tier apartment crypts, administrative offices, and memorial rows in Camaman-an, Cagayan de Oro.",
        gpsLat: 8.46571,
        gpsLng: 124.65700,
      },
    });
  }

  const activeRowKeys = Object.keys(preset.rows);
  let cmpPlotCount = 0;
  for (let rIdx = 0; rIdx < activeRowKeys.length; rIdx++) {
    const rowCode = activeRowKeys[rIdx];
    const rowData = preset.rows[rowCode];

    let sectionDetail = await prisma.locationDetail.findFirst({
      where: { locationId: cmpLocation.id, subsection: rowCode },
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
    }

    for (const pDef of rowData.plots) {
      await prisma.plot.upsert({
        where: {
          locationDetailId_plotNumber: {
            locationDetailId: sectionDetail.id,
            plotNumber: pDef.plotNumber,
          },
        },
        update: {
          gpsLat: pDef.lat,
          gpsLng: pDef.lng,
          status: pDef.status || "available",
        },
        create: {
          locationDetailId: sectionDetail.id,
          plotNumber: pDef.plotNumber,
          status: pDef.status || "available",
          gpsLat: pDef.lat,
          gpsLng: pDef.lng,
        },
      });
      cmpPlotCount++;
    }
  }
  console.log(`  ✓ CMP Location and ${cmpPlotCount} preset apartment crypt plots created or verified`);

  const walagPlot = await prisma.plot.findFirst({
    where: { plotNumber: "WALAG-001" },
    include: { graves: true },
  });
  if (walagPlot && (!walagPlot.graves || walagPlot.graves.length === 0)) {
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
        plotId: walagPlot.id,
        deceasedName: "Beatriz and Nimfa Walag",
        burialDate: new Date("2021-10-14"),
        status: "active",
        verificationStatus: "verified",
        verifiedAt: new Date(),
        verifiedById: users[0].id,
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
    console.log("  ✓ Beatriz and Nimfa Walag multi-tier grave verified");
  }

  console.log("\n✅ Seeding complete. Credentials were sourced from environment variables and were not printed.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
