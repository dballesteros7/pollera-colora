import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SESSION_TOKEN } from "./seed";
import { STATE_PATH } from "./paths";

const { groupId } = JSON.parse(readFileSync(STATE_PATH, "utf8")) as { groupId: string };

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "polla_session", value: SESSION_TOKEN, domain: "127.0.0.1", path: "/" },
  ]);
});

// regions whose text moves with the wall clock — masked so baselines are stable:
// detail countdown + meta date, chip score/time, and the tab-bar countdowns
const dynamic =
  ".pc-countdown, .pc-match__meta, .pc-daychip__sub, .pc-tabbar__sub";

test("group home — day board", async ({ page }) => {
  await page.goto(`/g/${groupId}`);
  await page.waitForSelector(".pc-daysec");
  await expect(page).toHaveScreenshot("home.png", {
    fullPage: true,
    mask: [page.locator(dynamic)],
  });
});

test("group home — Colombia detail (egg button)", async ({ page }) => {
  await page.goto(`/g/${groupId}`);
  await page.getByRole("tab", { name: /COL/ }).click();
  // the patriotic button confirms the predict card for Colombia is showing
  await page.waitForSelector(".pc-co-btn");
  await expect(page).toHaveScreenshot("home-colombia.png", {
    fullPage: true,
    mask: [page.locator(dynamic)],
  });
});
