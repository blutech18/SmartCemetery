const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Smart Cemetery database...\n");

  // Load the ESM encryption helper so sensitive GraveDetail fields are stored
  // encrypted at rest (matching the API write path). Dynamic import bridges
  // this CommonJS seed to the ESM module.
  const { encryptField } = await import("../src/lib/encryption.js");

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

  // 2. Create Default Users
  console.log("Creating default users...");
  const passwordHash = await bcrypt.hash("password123", 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@cemetery.gov.ph" },
      update: {},
      create: {
        name: "System Administrator",
        email: "admin@cemetery.gov.ph",
        passwordHash,
        userTypeId: userTypes[0].id,
        status: "active",
      },
    }),
    prisma.user.upsert({
      where: { email: "staff@cemetery.gov.ph" },
      update: {},
      create: {
        name: "Maria Santos",
        email: "staff@cemetery.gov.ph",
        passwordHash,
        userTypeId: userTypes[1].id,
        status: "active",
      },
    }),
    prisma.user.upsert({
      where: { email: "visitor@example.com" },
      update: {},
      create: {
        name: "Juan Dela Cruz",
        email: "visitor@example.com",
        passwordHash,
        userTypeId: userTypes[2].id,
        status: "active",
      },
    }),
  ]);
  console.log(`  ✓ ${users.length} users created`);

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
            { subsection: "A1", capacity: 50 },
            { subsection: "A2", capacity: 50 },
            { subsection: "A3", capacity: 40 },
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
            { subsection: "B1", capacity: 60 },
            { subsection: "B2", capacity: 45 },
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
            { subsection: "C1", capacity: 30 },
            { subsection: "C2", capacity: 35 },
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
    where: { status: "occupied" },
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

    // Add details for some graves
    if (i % 2 === 0) {
      await prisma.graveDetail.create({
        data: {
          graveId: grave.id,
          // Sensitive fields are encrypted at rest (Req 3.1); notes stays plaintext.
          causeOfDeath: encryptField("Natural causes"),
          contactPerson: encryptField(`Family of ${sampleNames[i]}`),
          contactPhone: encryptField(`+63 9${Math.floor(100000000 + Math.random() * 900000000)}`),
          notes: "Well-maintained plot with regular family visits.",
        },
      });
    }
  }
  console.log(`  ✓ ${Math.min(occupiedPlots.length, sampleNames.length)} grave records created`);

  // 6. Create Sample Requests
  console.log("Creating sample requests...");
  await Promise.all([
    prisma.request.create({
      data: {
        userId: users[2].id,
        type: "reservation",
        description: "Requesting plot reservation in Section A for upcoming family burial.",
        status: "pending",
        referenceId: "REQ-SAMPLE-001",
      },
    }),
    prisma.request.create({
      data: {
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

  console.log("\n✅ Seeding complete!");
  console.log("\n📋 Login Credentials:");
  console.log("  Admin:   admin@cemetery.gov.ph / password123");
  console.log("  Staff:   staff@cemetery.gov.ph / password123");
  console.log("  Visitor: visitor@example.com  / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
