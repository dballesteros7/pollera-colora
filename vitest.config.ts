import { defineConfig } from "vitest/config";

// Unit tests are *.test.ts. Playwright visual specs live in tests/visual/*.spec.ts
// and must NOT be picked up by Vitest (they import @playwright/test).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/visual/**", "node_modules/**", ".next/**"],
  },
});
