import { spawnSync } from "node:child_process";

const testUrl = process.env.TEST_DATABASE_URL;
if (process.env.ALLOW_LIVE_MYSQL_TESTS !== "yes") {
  throw new Error("Set ALLOW_LIVE_MYSQL_TESTS=yes to run disposable MySQL tests");
}
if (!testUrl) throw new Error("TEST_DATABASE_URL is required");
if (testUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
}

let parsed;
try {
  parsed = new URL(testUrl);
} catch {
  throw new Error("TEST_DATABASE_URL must be a valid MySQL URL");
}
const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
if (!parsed.protocol.startsWith("mysql") || !databaseName.includes("test")) {
  throw new Error("Refusing to run: test database name must contain 'test'");
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  RUN_LIVE_MYSQL: "1",
};

function run(args) {
  const result = spawnSync(executable, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["prisma", "migrate", "deploy"]);
run(["vitest", "run", "src/live/mysql.integration.test.js"]);