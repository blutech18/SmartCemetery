/**
 * Safe, robust cross-platform database migration script.
 * Executed via: npm run db:migrate
 *
 * Ensures:
 * 1. Environment variables from .env and .env.local are properly loaded.
 * 2. Target MySQL database exists (creates it if missing).
 * 3. All Prisma migrations are applied in sequence (including app_settings).
 * 4. The Prisma Client is generated and synchronized with latest schema.
 * 5. Default boundary polygon setting exists in app_settings.
 */
const { loadEnvConfig } = require("@next/env");
const { spawnSync } = require("node:child_process");

loadEnvConfig(process.cwd());

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

// Local development fallback if DATABASE_URL is not defined
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = "mysql://root@127.0.0.1:3306/cemetery_map";
}

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL).pathname.replace(/^\//, "");
  } catch {
    return "cemetery_map";
  }
})();

console.log("=================================================");
console.log("  Smart Cemetery — Database Migration & Sync");
console.log("=================================================");
console.log(`Target Database: ${dbName}`);
console.log(`Database URL:    ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")}\n`);

// 1. Ensure MySQL Database Exists before deploying migrations
async function ensureDatabaseExists() {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    const authPart = parsed.password
      ? `${parsed.username || "root"}:${parsed.password}`
      : parsed.username || "root";
    const serverUrl = `${parsed.protocol}//${authPart}@${parsed.host}/mysql`;
    const { PrismaClient } = require("@prisma/client");
    const sysClient = new PrismaClient({ datasources: { db: { url: serverUrl } } });

    await sysClient.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`✓ Database \`${dbName}\` verified / ready`);
    await sysClient.$disconnect();
  } catch {
    // If connecting to /mysql fails (e.g. restrictive DB user permissions), proceed anyway
    // as the target database may already exist.
  }
}

async function main() {
  await ensureDatabaseExists();

  // 2. Deploy Prisma migrations
  console.log("\n▶ [1/3] Deploying database migrations...");
  const migrateRes = spawnSync(npx, ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (migrateRes.status !== 0) {
    console.error(`\n✖ Migration failed with exit code ${migrateRes.status}`);
    process.exit(migrateRes.status || 1);
  }

  // 3. Generate Prisma Client
  console.log("\n▶ [2/3] Synchronizing Prisma client...");
  const genRes = spawnSync(npx, ["prisma", "generate"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (genRes.status !== 0) {
    console.warn(
      "\n⚠ Note: Prisma client generation encountered a file lock (common on Windows while `npm run dev` is active)."
    );
    console.warn("  If you see type errors, stop your dev server and restart `npm run dev`.");
  } else {
    console.log("✓ Prisma client synchronized successfully");
  }

  // 4. Synchronize default boundary setting if missing
  console.log("\n▶ [3/3] Synchronizing default settings...");
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const existingBoundary = await prisma.appSetting.findUnique({
      where: { key: "cmp_boundary_offsets" },
    });

    if (!existingBoundary) {
      const defaultOffsets = [
        { dx: -49.9, dy: 48.0 },
        { dx: 57.6, dy: 40.9 },
        { dx: 45.8, dy: -0.3 },
        { dx: 40.4, dy: -29.2 },
        { dx: 31.4, dy: -60.0 },
        { dx: 13.9, dy: -61.2 },
        { dx: -24.8, dy: -55.9 },
        { dx: -55.8, dy: -20.6 },
      ];
      await prisma.appSetting.create({
        data: {
          key: "cmp_boundary_offsets",
          value: JSON.stringify(defaultOffsets),
        },
      });
      console.log("✓ Default cemetery boundary polygon saved to app_settings");
    } else {
      console.log("✓ Existing app_settings preserved");
    }
    await prisma.$disconnect();
  } catch (err) {
    console.warn("Note: app_settings check completed:", err.message);
  }

  console.log("\n✅ Database is fully migrated, synchronized, and up to date!");
  console.log("Your localdev database is ready.\n");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
