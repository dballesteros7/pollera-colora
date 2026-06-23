import { defineConfig } from "@playwright/test";
import { DB_PATH } from "./tests/visual/paths";

// Visual regression across form factors. A seeded DB + injected session render
// the real pages; screenshots are captured at five viewports. Time-dependent
// text (countdowns, kickoff times) is masked in the specs so baselines are stable.
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/visual",
  globalSetup: "./tests/visual/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // list for the console, html for the diff viewer (Diff/Actual/Expected slider).
  // The html report (open: never) is what the CI `visual` job uploads.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  // freeze animations + a touch of tolerance for AA/font rendering jitter
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_PATH: DB_PATH,
      // neuter the fixtures scheduler so it can't clobber the seeded matches
      FOOTBALL_DATA_TOKEN: "",
      APP_URL: `http://127.0.0.1:${PORT}`,
    },
  },
  projects: [
    { name: "iphone-se", use: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 } },
    { name: "iphone-14", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 } },
    { name: "pixel-7", use: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6 } },
    { name: "ipad", use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  ],
});
