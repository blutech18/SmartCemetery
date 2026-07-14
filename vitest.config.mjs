import { defineConfig, configDefaults } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the project's `@/*` module alias (defined in jsconfig.json) so tests
// can import source modules the same way the app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure logic modules in `src/lib` are tested in the Node environment.
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs}"],
    // Playwright viewport specs live in `e2e/` and use the Playwright runner,
    // not Vitest. Exclude them (and Playwright's `*.pw.spec.js` naming) so
    // `npm test` does not try to load them.
    exclude: [...configDefaults.exclude, "e2e/**", "**/*.pw.spec.js"],
  },
});
