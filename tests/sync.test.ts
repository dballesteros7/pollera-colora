import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { matches } from "../lib/db/schema";
import {
  upsertMatches,
  regulationScore,
  isLiveWindow,
  isRegression,
} from "../lib/sync";
import type { FdMatch } from "../lib/fd/types";

const NOW = new Date("2026-06-11T20:00:00Z");

function fdMatch(overrides: Partial<FdMatch> = {}): FdMatch {
  return {
    id: 500001,
    utcDate: "2026-06-11T19:00:00Z",
    status: "TIMED",
    stage: "GROUP_STAGE",
    matchday: 1,
    homeTeam: {
      id: 1,
      name: "Mexico",
      shortName: "Mexico",
      tla: "MEX",
      crest: "https://crests.football-data.org/mex.png",
    },
    awayTeam: {
      id: 2,
      name: "Colombia",
      shortName: "Colombia",
      tla: "COL",
      crest: "https://crests.football-data.org/col.png",
    },
    score: {
      winner: null,
      duration: "REGULAR",
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
    ...overrides,
  };
}

describe("regulationScore", () => {
  it("uses fullTime for regular-duration matches", () => {
    const m = fdMatch({
      status: "FINISHED",
      score: {
        winner: "HOME_TEAM",
        duration: "REGULAR",
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 0 },
      },
    });
    expect(regulationScore(m)).toEqual({ home: 2, away: 1 });
  });

  it("uses regularTime when the match went to extra time", () => {
    const m = fdMatch({
      status: "FINISHED",
      score: {
        winner: "AWAY_TEAM",
        duration: "EXTRA_TIME",
        fullTime: { home: 1, away: 2 }, // includes ET goal
        halfTime: { home: 0, away: 0 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 1 },
      },
    });
    expect(regulationScore(m)).toEqual({ home: 1, away: 1 });
  });

  it("uses regularTime for penalty shootouts", () => {
    const m = fdMatch({
      status: "FINISHED",
      score: {
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 0, away: 0 },
        halfTime: { home: 0, away: 0 },
        regularTime: { home: 0, away: 0 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 4, away: 3 },
      },
    });
    expect(regulationScore(m)).toEqual({ home: 0, away: 0 });
  });
});

describe("upsertMatches", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("inserts new matches", () => {
    const result = upsertMatches(db, [fdMatch()], NOW);
    expect(result).toMatchObject({ total: 1, upserted: 1 });
    const row = db.select().from(matches).all()[0];
    expect(row.fdId).toBe(500001);
    expect(row.homeTeam).toBe("Mexico");
    expect(row.status).toBe("TIMED");
  });

  it("updates on change and reports result changes", () => {
    upsertMatches(db, [fdMatch()], NOW);
    const finished = fdMatch({
      status: "FINISHED",
      score: {
        winner: "DRAW",
        duration: "REGULAR",
        fullTime: { home: 1, away: 1 },
        halfTime: { home: 0, away: 1 },
      },
    });
    const result = upsertMatches(db, [finished], NOW);
    expect(result.upserted).toBe(1);
    expect(result.resultsChanged).toHaveLength(1);
    const row = db.select().from(matches).all()[0];
    expect(row.regHome).toBe(1);
    expect(row.regAway).toBe(1);
  });

  it("is a no-op when nothing changed", () => {
    upsertMatches(db, [fdMatch()], NOW);
    const result = upsertMatches(db, [fdMatch()], NOW);
    expect(result.upserted).toBe(0);
    expect(result.resultsChanged).toHaveLength(0);
  });

  it("never touches manually overridden rows", () => {
    upsertMatches(db, [fdMatch()], NOW);
    db.update(matches)
      .set({ manualOverride: true, regHome: 9, regAway: 9 })
      .where(eq(matches.fdId, 500001))
      .run();

    const apiUpdate = fdMatch({
      status: "FINISHED",
      score: {
        winner: "HOME_TEAM",
        duration: "REGULAR",
        fullTime: { home: 3, away: 0 },
        halfTime: { home: 2, away: 0 },
      },
    });
    const result = upsertMatches(db, [apiUpdate], NOW);
    expect(result.skippedOverridden).toBe(1);
    const row = db.select().from(matches).all()[0];
    expect(row.regHome).toBe(9); // manual value preserved
  });

  it("fills in TBD knockout teams when they become known", () => {
    const tbd = fdMatch({
      id: 500100,
      stage: "LAST_16",
      matchday: null,
      homeTeam: { id: null, name: null, shortName: null, tla: null, crest: null },
      awayTeam: { id: null, name: null, shortName: null, tla: null, crest: null },
    });
    upsertMatches(db, [tbd], NOW);
    let row = db.select().from(matches).all()[0];
    expect(row.homeTeam).toBeNull();

    const known = fdMatch({
      id: 500100,
      stage: "LAST_16",
      matchday: null,
    });
    const result = upsertMatches(db, [known], NOW);
    expect(result.upserted).toBe(1);
    row = db.select().from(matches).all()[0];
    expect(row.homeTeam).toBe("Mexico");
  });
});

describe("regression guard", () => {
  it("classifies stale snapshots", () => {
    const live = { status: "IN_PLAY", regHome: 1, regAway: 0 };
    expect(isRegression(live, { status: "TIMED", regHome: null, regAway: null })).toBe(true);
    expect(isRegression(live, { status: "IN_PLAY", regHome: null, regAway: null })).toBe(true);
    expect(isRegression(live, { status: "PAUSED", regHome: 1, regAway: 0 })).toBe(false);
    expect(isRegression(live, { status: "FINISHED", regHome: 2, regAway: 0 })).toBe(false);
    expect(isRegression({ status: "FINISHED", regHome: 2, regAway: 0 }, { status: "IN_PLAY", regHome: 2, regAway: 0 })).toBe(true);
    // legitimate backwards transitions pass through
    expect(isRegression(live, { status: "SUSPENDED", regHome: null, regAway: null })).toBe(false);
  });

  it("upsert rejects stale list snapshots", () => {
    const db = createDb(":memory:");
    const live = fdMatch({
      status: "IN_PLAY",
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: 1, away: 0 },
        halfTime: { home: 1, away: 0 },
      },
    });
    upsertMatches(db, [live], NOW);

    // stale cache snapshot arrives a tick later
    const stale = fdMatch(); // TIMED, null score
    const result = upsertMatches(db, [stale], NOW);
    expect(result.skippedStale).toBe(1);
    expect(result.upserted).toBe(0);
    const row = db.select().from(matches).all()[0];
    expect(row.status).toBe("IN_PLAY");
    expect(row.regHome).toBe(1);
  });
});

describe("isLiveWindow", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("true when a match is in play", () => {
    upsertMatches(db, [fdMatch({ status: "IN_PLAY" })], NOW);
    expect(isLiveWindow(db, NOW)).toBe(true);
  });

  it("true shortly before kickoff", () => {
    // kickoff 19:00, now 18:50
    expect(
      isLiveWindow(db, new Date("2026-06-11T18:50:00Z")),
    ).toBe(false); // empty db
    upsertMatches(db, [fdMatch()], NOW);
    expect(isLiveWindow(db, new Date("2026-06-11T18:50:00Z"))).toBe(true);
  });

  it("false when all matches are finished or far away", () => {
    upsertMatches(
      db,
      [
        fdMatch({
          status: "FINISHED",
          score: {
            winner: "DRAW",
            duration: "REGULAR",
            fullTime: { home: 0, away: 0 },
            halfTime: { home: 0, away: 0 },
          },
        }),
        fdMatch({ id: 500002, utcDate: "2026-06-15T19:00:00Z" }),
      ],
      NOW,
    );
    expect(isLiveWindow(db, new Date("2026-06-12T12:00:00Z"))).toBe(false);
  });
});
