import cron from "node-cron";
import { lt } from "drizzle-orm";
import { getDb } from "./db";
import { otpCodes, sessions } from "./db/schema";
import { syncMatches, isLiveWindow } from "./sync";
import { rebuildAllScores } from "./scoring/score";
import { appendSnapshot } from "./metrics";
import { FdConfigError } from "./fd/client";

const IDLE_INTERVAL_MS = 15 * 60 * 1000;

export interface SyncStatus {
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __polleraSchedulerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __polleraSyncStatus: SyncStatus | undefined;
}

export function getSyncStatus(): SyncStatus {
  return (globalThis.__polleraSyncStatus ??= {
    lastOkAt: null,
    lastErrorAt: null,
    lastError: null,
  });
}

export function startScheduler() {
  if (globalThis.__polleraSchedulerStarted) return;
  globalThis.__polleraSchedulerStarted = true;

  let lastSyncAt = 0;
  let running = false;
  let runningSince = 0;
  let lastSnapshotHour = -1;
  let lastCleanupDay = -1;

  // tick every minute; the tick decides whether it's time to actually sync
  cron.schedule("* * * * *", async () => {
    if (running) {
      // belt and braces: fetch timeouts should make hangs impossible, but a
      // stuck flag must never silence the scheduler forever again
      if (Date.now() - runningSince > 5 * 60 * 1000) {
        console.error("[sync] watchdog: previous run stuck >5min, resetting");
        running = false;
      } else {
        return;
      }
    }
    running = true;
    runningSince = Date.now();
    try {
      const db = getDb();
      const now = new Date();
      if (now.getUTCHours() !== lastSnapshotHour) {
        lastSnapshotHour = now.getUTCHours();
        try {
          appendSnapshot(db, now);
        } catch (err) {
          console.warn("[metrics] snapshot failed:", err);
        }
      }
      // daily sweep of expired auth rows — neither table cleans itself up
      if (now.getUTCDate() !== lastCleanupDay) {
        lastCleanupDay = now.getUTCDate();
        try {
          db.delete(otpCodes).where(lt(otpCodes.expiresAt, now)).run();
          db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
        } catch (err) {
          console.warn("[cleanup] expired-row sweep failed:", err);
        }
      }
      const due =
        isLiveWindow(db, now) ||
        now.getTime() - lastSyncAt >= IDLE_INTERVAL_MS;
      if (!due) return;
      const result = await syncMatches(db, now);
      lastSyncAt = now.getTime();
      getSyncStatus().lastOkAt = new Date().toISOString();
      if (result.upserted > 0 || result.skippedStale > 0) {
        console.log(
          `[sync] ok: ${result.total} matches, ${result.upserted} upserted, ${result.skippedStale} stale rejected`,
        );
      }
      if (result.resultsChanged.length > 0) {
        console.log(
          `[sync] results changed for matches ${result.resultsChanged.join(", ")} — rebuilding scores`,
        );
        rebuildAllScores(db, now);
      }
    } catch (err) {
      if (err instanceof FdConfigError) {
        // no API token yet — stay quiet but visible, retry next idle tick
        console.warn(`[sync] skipped: ${err.message}`);
        lastSyncAt = Date.now();
      } else {
        console.error("[sync] failed:", err);
        const status = getSyncStatus();
        status.lastErrorAt = new Date().toISOString();
        status.lastError = err instanceof Error ? err.message : String(err);
      }
    } finally {
      running = false;
    }
  });

  console.log("[scheduler] fixtures sync scheduled (60s live / 15min idle)");
}
