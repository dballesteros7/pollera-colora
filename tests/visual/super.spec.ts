import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SESSION_TOKEN } from "./seed";
import { STATE_PATH } from "./paths";

const { superId } = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
  superId: string;
};

// clock-dependent text masked so the baseline is stable: the pick card's kickoff
// date/time + stage meta, and the chip strip's time
const dynamic = ".pc-match__meta, .pc-match__time, .pc-daychip__sub";

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "polla_session", value: SESSION_TOKEN, domain: "127.0.0.1", path: "/" },
  ]);
});

// The Súper Polla pick card with a pre-filled (copied-from-home) pick — the
// "Pre-llenado con el de tu polla…" hint must sit inside the card's padding,
// not flush against the edge / accent rail.
test("súper polla — pick card with copied hint", async ({ page }) => {
  await page.goto(`/g/${superId}`);
  await page.waitForSelector(".pc-daysec");
  await expect(page).toHaveScreenshot("super-pick.png", {
    fullPage: true,
    mask: [page.locator(dynamic)],
  });
});
