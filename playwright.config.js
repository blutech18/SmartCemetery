// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Playwright configuration for mobile-responsiveness viewport tests of the
 * public pages (Requirement 16.1–16.5, design section 15).
 *
 * Scoped to the `e2e/` directory so Vitest and Playwright never pick up each
 * other's specs. Vitest excludes `e2e/**` (see vitest.config.mjs) and
 * Playwright only looks inside `testDir` below.
 */

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Mobile viewport matrix covering the 320–767px band plus a landscape variant
// and a sub-320px width (Req 16.4 orientation re-flow, Req 16.5 sub-320px).
const viewports = [
  { name: "portrait-320", width: 320, height: 568, orientation: "portrait" },
  { name: "portrait-375", width: 375, height: 667, orientation: "portrait" },
  { name: "portrait-767", width: 767, height: 1024, orientation: "portrait" },
  { name: "landscape-667", width: 667, height: 375, orientation: "landscape" },
  { name: "sub-320", width: 280, height: 653, orientation: "portrait" },
];

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: BASE_URL,
    // Public data-driven pages may fail their DB fetches in restricted
    // environments; rely on domcontentloaded rather than full network idle
    // so the rendered chrome is still evaluable.
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: viewports.map((vp) => ({
    name: vp.name,
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: vp.width, height: vp.height },
      isMobile: false, // Chromium desktop engine; viewport drives the layout
      // Expose the intended dimensions/orientation to tests via metadata.
      // (Playwright merges `use` per project; tests read the project name.)
    },
    metadata: vp,
  })),
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
