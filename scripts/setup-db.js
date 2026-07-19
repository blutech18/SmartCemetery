/**
 * One-command local database setup for XAMPP (MySQL).
 *
 * Run with:  npm run db:setup
 *
 * It will, in order:
 *   1. Create the database (if missing) and apply every Prisma migration.
 *   2. Generate the Prisma client.
 *   3. Seed baseline data (users, locations, plots, sample graves).
 *
 * Any value already present in your `.env` / `.env.local` is respected. The
 * defaults below only fill in what is missing so the command works on a fresh
 * XAMPP install (MySQL on 127.0.0.1:3306, user "root", no password) with no
 * manual configuration. These defaults are for LOCAL DEVELOPMENT ONLY.
 */
const { loadEnvConfig } = require("@next/env");
const { spawnSync } = require("node:child_process");

loadEnvConfig(process.cwd());

// Local-development fallbacks (used only when the variable is not already set).
const DEV_DEFAULTS = {
  // Stock XAMPP MySQL: root user with an empty password on port 3306.
  DATABASE_URL: "mysql://root@127.0.0.1:3306/cemetery_map",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "local-development-nextauth-secret-change-me-32chars",
  // 32-byte (64 hex) AES key — local dev only. Do not use in production.
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  ENCRYPTION_KEY_VERSION: "v1",
  ENCRYPTION_KEY_PREVIOUS: "{}",
  // Seed accounts (min 12-character passwords required by the seed).
  SEED_ADMIN_EMAIL: "admin@cemetery.gov.ph",
  SEED_ADMIN_PASSWORD: "Password123!",
  SEED_STAFF_EMAIL: "staff@cemetery.gov.ph",
  SEED_STAFF_PASSWORD: "Password123!",
  SEED_CLIENT_EMAIL: "visitor@example.com",
  SEED_CLIENT_PASSWORD: "Password123!",
};

for (const [key, value] of Object.entries(DEV_DEFAULTS)) {
  if (!process.env[key] || process.env[key].trim() === "") {
    process.env[key] = value;
  }
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const dbName = (() => {
  try { return new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ""); }
  catch { return "(invalid DATABASE_URL)"; }
})();

function step(label, command, args, { optional = false, note = "" } = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  const failed = Boolean(result.error) || result.status !== 0;
  if (failed && optional) {
    const reason = result.error ? result.error.message : `exit code ${result.status}`;
    console.warn(`\n⚠ ${label} was skipped (${reason}).`);
    if (note) console.warn(`  ${note}`);
    return;
  }
  if (result.error) {
    console.error(`\n✖ ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed (exit code ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

console.log("Smart Cemetery — local database setup");
console.log(`Target database: ${dbName}`);
console.log("Make sure XAMPP's MySQL service is running before continuing.");

step("1/3 Applying migrations (creates the database if needed)", npx, ["prisma", "migrate", "deploy"]);
step("2/3 Generating the Prisma client", npx, ["prisma", "generate"], {
  optional: true,
  note: "The client is already generated during `npm install`. Stop the dev server and rerun `npm run db:generate` if you changed the schema.",
});
step("3/3 Seeding baseline data", "node", ["prisma/seed.js"]);

console.log("\n✅ Database ready.");
console.log("\nLogin accounts (local development):");
console.log(`  Admin  → ${process.env.SEED_ADMIN_EMAIL}  /  ${process.env.SEED_ADMIN_PASSWORD}`);
console.log(`  Staff  → ${process.env.SEED_STAFF_EMAIL}  /  ${process.env.SEED_STAFF_PASSWORD}`);
console.log(`  Client → ${process.env.SEED_CLIENT_EMAIL}  /  ${process.env.SEED_CLIENT_PASSWORD}`);
console.log("\nStart the app with:  npm run dev");
