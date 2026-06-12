import { eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { matches } from "./db/schema";
import { fetchWorldCupMatches, fetchMatch } from "./fd/client";
import type { FdMatch } from "./fd/types";

// Progress rank: the API's list endpoint can serve stale snapshots, so we
// never let a sync move a match backwards. POSTPONED/CANCELLED/SUSPENDED are
// legitimate "backwards" transitions and bypass the guard.
const STATUS_RANK: Record<string, number> = {
  SCHEDULED: 0,
  TIMED: 0,
  IN_PLAY: 1,
  PAUSED: 1,
  FINISHED: 2,
  AWARDED: 2,
};
const GUARD_BYPASS = new Set(["POSTPONED", "CANCELLED", "SUSPENDED"]);
// statuses that count for scoring (AWARDED = walkover with an official result)
export const TERMINAL = new Set(["FINISHED", "AWARDED"]);

type ResultFields = {
  status: string;
  regHome?: number | null;
  regAway?: number | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
};

export function isRegression(prev: ResultFields, next: ResultFields): boolean {
  // never wipe a known score or known team names with nulls — applies even to
  // POSTPONED/SUSPENDED transitions, which only bypass the rank check
  if (prev.regHome != null && next.regHome == null) return true;
  if (prev.regAway != null && next.regAway == null) return true;
  if (prev.homeTeam != null && next.homeTeam == null) return true;
  if (prev.awayTeam != null && next.awayTeam == null) return true;
  if (GUARD_BYPASS.has(next.status)) return false;
  const prevRank = STATUS_RANK[prev.status] ?? 0;
  const nextRank = STATUS_RANK[next.status] ?? 0;
  return nextRank < prevRank;
}

export type MatchRow = typeof matches.$inferInsert;

// Predictions score on regulation time: when a knockout match goes to extra
// time, fullTime includes the extra 30 minutes and regularTime holds the
// 90-minute score. Penalty shootouts never count.
export function regulationScore(m: FdMatch): {
  home: number | null;
  away: number | null;
} {
  const s = m.score;
  if (s.duration !== "REGULAR" && s.regularTime) {
    return { home: s.regularTime.home, away: s.regularTime.away };
  }
  return { home: s.fullTime.home, away: s.fullTime.away };
}

export function mapFdMatch(m: FdMatch, now: Date): MatchRow {
  const reg = regulationScore(m);
  return {
    fdId: m.id,
    stage: m.stage,
    matchday: m.matchday,
    kickoffUtc: new Date(m.utcDate),
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeCrest: m.homeTeam.crest,
    awayCrest: m.awayTeam.crest,
    status: m.status,
    duration: m.score.duration,
    regHome: reg.home,
    regAway: reg.away,
    finalHome: m.score.fullTime.home,
    finalAway: m.score.fullTime.away,
    updatedAt: now,
  };
}

export interface SyncResult {
  total: number;
  upserted: number;
  skippedOverridden: number;
  skippedStale: number; // stale API snapshots rejected by the regression guard
  resultsChanged: number[]; // internal match ids whose result fields changed
}

export function upsertMatches(
  db: Db,
  fdMatches: FdMatch[],
  now: Date,
): SyncResult {
  const overridden = new Set(
    db
      .select({ fdId: matches.fdId })
      .from(matches)
      .where(eq(matches.manualOverride, true))
      .all()
      .map((r) => r.fdId),
  );

  const fdIds = fdMatches.map((m) => m.id);
  const existing = new Map(
    (fdIds.length
      ? db.select().from(matches).where(inArray(matches.fdId, fdIds)).all()
      : []
    ).map((r) => [r.fdId, r]),
  );

  const resultsChanged: number[] = [];
  let upserted = 0;
  let skippedOverridden = 0;
  let skippedStale = 0;

  for (const fdMatch of fdMatches) {
    if (overridden.has(fdMatch.id)) {
      skippedOverridden++;
      continue;
    }
    const row = mapFdMatch(fdMatch, now);
    const prev = existing.get(fdMatch.id);
    if (prev && isRegression(prev, row)) {
      skippedStale++;
      continue;
    }
    if (!prev) {
      const inserted = db.insert(matches).values(row).returning().get();
      if (TERMINAL.has(row.status ?? "")) resultsChanged.push(inserted.id);
      upserted++;
      continue;
    }
    const changed =
      prev.status !== row.status ||
      prev.regHome !== row.regHome ||
      prev.regAway !== row.regAway ||
      prev.finalHome !== row.finalHome ||
      prev.finalAway !== row.finalAway ||
      prev.homeTeam !== row.homeTeam ||
      prev.awayTeam !== row.awayTeam ||
      prev.kickoffUtc.getTime() !== row.kickoffUtc.getTime();
    if (!changed) continue;

    db.update(matches).set(row).where(eq(matches.fdId, fdMatch.id)).run();
    upserted++;
    const resultChanged =
      prev.regHome !== row.regHome ||
      prev.regAway !== row.regAway ||
      prev.status !== row.status;
    // scoring only counts terminal matches — mid-game goals don't need a rebuild
    if (resultChanged && (TERMINAL.has(row.status ?? "") || TERMINAL.has(prev.status)))
      resultsChanged.push(prev.id);
  }

  return {
    total: fdMatches.length,
    upserted,
    skippedOverridden,
    skippedStale,
    resultsChanged,
  };
}

// matches currently inside the live window per our DB (not yet FINISHED)
export function liveWindowMatches(db: Db, now: Date) {
  return db
    .select()
    .from(matches)
    .all()
    .filter((r) => {
      if (r.status === "IN_PLAY" || r.status === "PAUSED") return true;
      const diff = now.getTime() - r.kickoffUtc.getTime();
      return (
        diff >= -LIVE_WINDOW_BEFORE_MS &&
        diff <= LIVE_WINDOW_AFTER_MS &&
        !TERMINAL.has(r.status)
      );
    });
}

export async function syncMatches(db: Db, now = new Date()): Promise<SyncResult> {
  const fdMatches = await fetchWorldCupMatches();
  const result = upsertMatches(db, fdMatches, now);

  // The list endpoint lags behind live matches; re-fetch those individually
  // from the fresher single-match endpoint (a handful of requests at most).
  const live = liveWindowMatches(db, now);
  for (const m of live) {
    try {
      const fresh = await fetchMatch(m.fdId);
      const detail = upsertMatches(db, [fresh], now);
      result.upserted += detail.upserted;
      result.skippedStale += detail.skippedStale;
      result.resultsChanged.push(...detail.resultsChanged);
    } catch (err) {
      console.warn(`[sync] detail fetch failed for fdId ${m.fdId}:`, err);
    }
  }
  return result;
}

// Poll fast while anything is live or about to kick off; lazily otherwise.
const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const LIVE_WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;

export function isLiveWindow(db: Db, now: Date): boolean {
  const rows = db
    .select({ status: matches.status, kickoffUtc: matches.kickoffUtc })
    .from(matches)
    .all();
  return rows.some((r) => {
    if (r.status === "IN_PLAY" || r.status === "PAUSED") return true;
    const diff = now.getTime() - r.kickoffUtc.getTime();
    return diff >= -LIVE_WINDOW_BEFORE_MS && diff <= LIVE_WINDOW_AFTER_MS &&
      !TERMINAL.has(r.status);
  });
}
