import cron from "node-cron";
import { getDb } from "./db";
import { syncMatches, isLiveWindow } from "./sync";
import { FdConfigError } from "./fd/client";

const IDLE_INTERVAL_MS = 15 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __polleraSchedulerStarted: boolean | undefined;
}

export function startScheduler() {
  if (globalThis.__polleraSchedulerStarted) return;
  globalThis.__polleraSchedulerStarted = true;

  let lastSyncAt = 0;
  let running = false;

  // tick every minute; the tick decides whether it's time to actually sync
  cron.schedule("* * * * *", async () => {
    if (running) return;
    running = true;
    try {
      const db = getDb();
      const now = new Date();
      const due =
        isLiveWindow(db, now) ||
        now.getTime() - lastSyncAt >= IDLE_INTERVAL_MS;
      if (!due) return;
      const result = await syncMatches(db, now);
      lastSyncAt = now.getTime();
      if (result.resultsChanged.length > 0) {
        console.log(
          `[sync] results changed for matches ${result.resultsChanged.join(", ")}`,
        );
        // Phase 4 hooks in here: rebuild score cache for changed matches
      }
    } catch (err) {
      if (err instanceof FdConfigError) {
        // no API token yet — stay quiet but visible, retry next idle tick
        console.warn(`[sync] skipped: ${err.message}`);
        lastSyncAt = Date.now();
      } else {
        console.error("[sync] failed:", err);
      }
    } finally {
      running = false;
    }
  });

  console.log("[scheduler] fixtures sync scheduled (60s live / 15min idle)");
}
