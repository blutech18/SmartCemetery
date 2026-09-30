const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const isYes = (v) => ["yes", "true", "1"].includes(String(v || "").trim().toLowerCase());
const seedDemo = isYes(process.env.SEED_DEMO_DATA);
const seedLayout = isYes(process.env.SEED_LAYOUT_PRESET);

// Demo data invents people and burial records. Loading it into a production
// environment by accident would put fake records into a real registry, so it
// needs a second, explicit acknowledgement there.
if (seedDemo && process.env.NODE_ENV === "production" && !isYes(process.env.ALLOW_DEMO_DATA_IN_PRODUCTION)) {
  console.error(
    "✖ SEED_DEMO_DATA=yes with NODE_ENV=production would load invented burial records.\n" +
      "  If this really is a disposable environment, also set ALLOW_DEMO_DATA_IN_PRODUCTION=yes."
  );
  process.exit(1);
}

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

  // Demo data is for local development and CI only. It invents people, plots,
  // requests and feedback, so it is never loaded unless explicitly requested.
  if (seedDemo) {
    // 3. Create Locations
    console.log("Creating locations...");
    // Re-running the seed must not add another copy of each demo section.
    const ensureLocation = async (spec) => {
      const existing = await prisma.location.findFirst({
        where: { name: spec.name },
        include: { details: true },
      });
      return existing || prisma.location.create({ data: spec, include: { details: true } });
    };
    const locationSpecs = [
      {
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
      {
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
      {
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
    ];
    const locations = [];
    for (const spec of locationSpecs) locations.push(await ensureLocation(spec));
    console.log(`  ✓ ${locations.length} demo locations ready`);

    // 4. Create Plots
    console.log("Creating plots...");
    let plotCount = 0;
    for (const location of locations) {
      for (const detail of location.details) {
        const numPlots = Math.min(detail.capacity, 10); // Create 10 sample plots per subsection
        for (let i = 1; i <= numPlots; i++) {
          const status = i <= 6 ? "occupied" : i <= 8 ? "reserved" : "available";
          const plotNumber = `${detail.subsection}-${String(i).padStart(3, "0")}`;
          await prisma.plot.upsert({
            where: { locationDetailId_plotNumber: { locationDetailId: detail.id, plotNumber } },
            update: {},
            create: {
              locationDetailId: detail.id,
              plotNumber,
              status,
              gpsLat: Number(location.gpsLat) + (Math.random() - 0.5) * 0.001,
              gpsLng: Number(location.gpsLng) + (Math.random() - 0.5) * 0.001,
            },
          });
          plotCount++;
        }
      }
    }
    console.log(`  ✓ ${plotCount} demo plots ready`);

    // 5. Create Graves
    console.log("Creating grave records...");
    // Demo graves are created once; a re-run leaves them as they are.
    const demoPlotScope = { locationDetail: { locationId: { in: locations.map((l) => l.id) } } };
    const haveDemoGraves = (await prisma.grave.count({ where: { plot: demoPlotScope } })) > 0;
    const occupiedPlots = haveDemoGraves
      ? []
      : await prisma.plot.findMany({
          where: { status: "occupied", graves: { none: {} }, ...demoPlotScope },
          take: 30,
        });

    // Shared with scripts/cleanup-demo-duplicates.js so the two never drift apart.
    const { DEMO_GRAVE_NAMES } = await import("../src/lib/demo-data.js");
    const sampleNames = DEMO_GRAVE_NAMES;

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
    const sampleFeedback = [
      { rating: 5, comment: "Excellent navigation system! Found the grave location easily." },
      { rating: 4, comment: "Very useful app. Directions were clear and accurate." },
      { rating: 4, comment: "Great improvement over the old paper-based system." },
    ];
    for (const fb of sampleFeedback) {
      const exists = await prisma.feedback.findFirst({ where: { userId: users[2].id, comment: fb.comment } });
      if (!exists) await prisma.feedback.create({ data: { userId: users[2].id, ...fb } });
    }
    console.log("  ✓ sample feedback ready");
  } else {
    console.log("Skipping demo data (set SEED_DEMO_DATA=yes to load sample sections, graves, requests and feedback).");
  }

  // 4. Layout preset: plots only (positions, tiers) — never burial records.
  if (seedLayout) {
    console.log("Loading layout preset...");
    const preset = require("../src/lib/layout-preset.json");
    const { applyLayoutPresetToDb } = await import("../src/lib/layout-preset-db.js");
    const result = await applyLayoutPresetToDb(prisma, preset, undefined, {
      locationName: process.env.LAYOUT_LOCATION_NAME,
    });
    console.log(`  ✓ ${result.location.name}: ${result.totalPlots} plots in ${result.rowCount} rows`);
  } else {
    console.log("Skipping layout preset (set SEED_LAYOUT_PRESET=yes to load it).");
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
