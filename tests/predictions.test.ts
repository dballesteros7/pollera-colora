import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, matches, predictions } from "../lib/db/schema";
import { createGroup } from "../lib/groups";
import {
  savePrediction,
  savePredictionForGroups,
  copyPredictions,
  PredictionLockedError,
  MatchNotPredictableError,
  roundKey,
  getUserPredictions,
} from "../lib/predictions";

const NOW = new Date("2026-06-11T20:00:00Z");
const FUTURE = new Date("2026-06-12T19:00:00Z");
const PAST = new Date("2026-06-11T16:00:00Z");

describe("predictions", () => {
  let db: Db;
  let userId: string;
  let groupId: string;

  function makeMatch(over: Partial<typeof matches.$inferInsert> = {}) {
    return db
      .insert(matches)
      .values({
        fdId: Math.floor(Math.random() * 1e9),
        stage: "GROUP_STAGE",
        matchday: 1,
        kickoffUtc: FUTURE,
        homeTeam: "Mexico",
        awayTeam: "Colombia",
        status: "TIMED",
        updatedAt: NOW,
        ...over,
      })
      .returning()
      .get();
  }

  beforeEach(() => {
    db = createDb(":memory:");
    const u = db
      .insert(users)
      .values({ id: randomUUID(), email: "a@b.co", createdAt: NOW })
      .returning()
      .get();
    userId = u.id;
    groupId = createGroup(db, userId, {
      name: "Test",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    }).id;
  });

  it("saves and upserts a prediction before kickoff", () => {
    const m = makeMatch();
    savePrediction(db, { userId, groupId, matchId: m.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId, groupId, matchId: m.id, predHome: 0, predAway: 0 }, NOW);
    const mine = getUserPredictions(db, userId, groupId);
    expect(mine.size).toBe(1);
    expect(mine.get(m.id)).toMatchObject({ predHome: 0, predAway: 0 });
  });

  it("rejects predictions at/after kickoff", () => {
    const m = makeMatch({ kickoffUtc: PAST, status: "IN_PLAY" });
    expect(() =>
      savePrediction(db, { userId, groupId, matchId: m.id, predHome: 1, predAway: 0 }, NOW),
    ).toThrow(PredictionLockedError);
  });

  it("rejects TBD-team matches and bad scores", () => {
    const tbd = makeMatch({ homeTeam: null, awayTeam: null, stage: "LAST_16", matchday: null });
    expect(() =>
      savePrediction(db, { userId, groupId, matchId: tbd.id, predHome: 1, predAway: 0 }, NOW),
    ).toThrow(MatchNotPredictableError);

    const m = makeMatch();
    expect(() =>
      savePrediction(db, { userId, groupId, matchId: m.id, predHome: -1, predAway: 0 }, NOW),
    ).toThrow(MatchNotPredictableError);
    expect(() =>
      savePrediction(db, { userId, groupId, matchId: m.id, predHome: 1.5, predAway: 0 }, NOW),
    ).toThrow(MatchNotPredictableError);
  });

  it("joker is exclusive within a round", () => {
    const m1 = makeMatch();
    const m2 = makeMatch();
    const otherRound = makeMatch({ matchday: 2 });

    savePrediction(db, { userId, groupId, matchId: m1.id, predHome: 1, predAway: 0, joker: true, allowJoker: true }, NOW);
    savePrediction(db, { userId, groupId, matchId: otherRound.id, predHome: 1, predAway: 0, joker: true, allowJoker: true }, NOW);
    savePrediction(db, { userId, groupId, matchId: m2.id, predHome: 2, predAway: 2, joker: true, allowJoker: true }, NOW);

    const mine = getUserPredictions(db, userId, groupId);
    expect(mine.get(m1.id)?.joker).toBe(false); // displaced
    expect(mine.get(m2.id)?.joker).toBe(true);
    expect(mine.get(otherRound.id)?.joker).toBe(true); // different round untouched
  });

  it("joker ignored when the preset has none", () => {
    const m = makeMatch();
    savePrediction(db, { userId, groupId, matchId: m.id, predHome: 1, predAway: 0, joker: true, allowJoker: false }, NOW);
    expect(getUserPredictions(db, userId, groupId).get(m.id)?.joker).toBe(false);
  });

  it("roundKey distinguishes matchdays and knockout stages", () => {
    expect(roundKey({ stage: "GROUP_STAGE", matchday: 2 })).toBe("GROUP_2");
    expect(roundKey({ stage: "FINAL", matchday: null })).toBe("FINAL");
  });
});

describe("multi-polla helpers", () => {
  let db: Db;
  let userId: string;
  let g1: string;
  let g2: string;

  function makeMatch(over: Partial<typeof matches.$inferInsert> = {}) {
    return db
      .insert(matches)
      .values({
        fdId: Math.floor(Math.random() * 1e9),
        stage: "GROUP_STAGE",
        matchday: 1,
        kickoffUtc: new Date("2026-06-12T19:00:00Z"),
        homeTeam: "Mexico",
        awayTeam: "Colombia",
        status: "TIMED",
        updatedAt: new Date("2026-06-11T20:00:00Z"),
        ...over,
      })
      .returning()
      .get();
  }

  beforeEach(() => {
    db = createDb(":memory:");
    const NOW2 = new Date("2026-06-11T20:00:00Z");
    const u = db
      .insert(users)
      .values({ id: randomUUID(), email: "multi@b.co", createdAt: NOW2 })
      .returning()
      .get();
    userId = u.id;
    g1 = createGroup(db, userId, {
      name: "Oficina",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    }).id;
    g2 = createGroup(db, userId, {
      name: "Familia",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }).id;
  });

  it("savePredictionForGroups writes everywhere, joker only at origin", () => {
    const NOW2 = new Date("2026-06-11T20:00:00Z");
    const m = makeMatch();
    const saved = savePredictionForGroups(
      db,
      {
        userId,
        matchId: m.id,
        predHome: 2,
        predAway: 1,
        groups: [
          { groupId: g1, joker: true, allowJoker: true },
          { groupId: g2, joker: false, allowJoker: false },
        ],
      },
      NOW2,
    );
    expect(saved).toBe(2);
    expect(getUserPredictions(db, userId, g1).get(m.id)).toMatchObject({ predHome: 2, predAway: 1, joker: true });
    expect(getUserPredictions(db, userId, g2).get(m.id)).toMatchObject({ predHome: 2, predAway: 1, joker: false });
  });

  it("copyPredictions fills gaps only, skips locked, never copies jokers", () => {
    const NOW2 = new Date("2026-06-11T20:00:00Z");
    const open1 = makeMatch();
    const open2 = makeMatch();
    const locked = makeMatch({ kickoffUtc: new Date("2026-06-11T18:00:00Z") });

    // source group has predictions on all three (locked one inserted directly)
    savePrediction(db, { userId, groupId: g1, matchId: open1.id, predHome: 1, predAway: 0, joker: true, allowJoker: true }, NOW2);
    savePrediction(db, { userId, groupId: g1, matchId: open2.id, predHome: 3, predAway: 3 }, NOW2);
    db.insert(predictions).values({ userId, groupId: g1, matchId: locked.id, predHome: 2, predAway: 2, joker: false, updatedAt: NOW2 }).run();
    // target already has its own pick on open2
    savePrediction(db, { userId, groupId: g2, matchId: open2.id, predHome: 0, predAway: 0 }, NOW2);

    const copied = copyPredictions(db, { userId, fromGroupId: g1, toGroupId: g2 }, NOW2);
    expect(copied).toBe(1); // only open1
    const target = getUserPredictions(db, userId, g2);
    expect(target.get(open1.id)).toMatchObject({ predHome: 1, predAway: 0, joker: false });
    expect(target.get(open2.id)).toMatchObject({ predHome: 0, predAway: 0 }); // untouched
    expect(target.has(locked.id)).toBe(false); // locked skipped
  });
});
