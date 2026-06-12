// End-to-end flows across modules: sync → predictions → scoring → leaderboard,
// the recocha lifecycle, bonus picks, and multi-polla consistency. Everything
// runs against an in-memory SQLite, with API payloads as fixtures.
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, matches, groups } from "../lib/db/schema";
import {
  createGroup,
  joinGroup,
  getGroupByInviteCode,
  getGroupMembers,
} from "../lib/groups";
import {
  savePrediction,
  savePredictionForGroups,
  getUserPredictions as getUserPredictionsForTest,
  PredictionLockedError,
} from "../lib/predictions";
import { upsertMatches } from "../lib/sync";
import type { FdMatch } from "../lib/fd/types";
import { rebuildGroupScores, rebuildAllScores } from "../lib/scoring/score";
import { getLeaderboard } from "../lib/leaderboard";
import {
  proposeQuestion,
  voteQuestion,
  answerQuestion,
  resolveQuestion,
  getVoteTally,
  PropLockedError,
  PropStateError,
} from "../lib/props";
import { saveBonusPick, setOutcome, BonusLockedError } from "../lib/bonus";
import { parseDatetimeLocal, formatDatetimeLocal } from "../lib/viewer-tz";

const T0 = new Date("2026-06-12T20:00:00Z"); // "today" for these flows
const KICKOFF = new Date("2026-06-13T20:00:00Z");
const AFTER_MATCH = new Date("2026-06-13T22:00:00Z");

function fdMatch(over: {
  id: number;
  status: FdMatch["status"];
  fullTime?: { home: number | null; away: number | null };
  regularTime?: { home: number; away: number };
  duration?: FdMatch["score"]["duration"];
  stage?: string;
  matchday?: number | null;
  utcDate?: string;
  home?: string;
  away?: string;
}): FdMatch {
  return {
    id: over.id,
    utcDate: over.utcDate ?? KICKOFF.toISOString(),
    status: over.status,
    stage: over.stage ?? "GROUP_STAGE",
    matchday: over.matchday === undefined ? 1 : over.matchday,
    homeTeam: { id: 1, name: over.home ?? "Mexico", shortName: null, tla: null, crest: null },
    awayTeam: { id: 2, name: over.away ?? "Colombia", shortName: null, tla: null, crest: null },
    score: {
      winner: null,
      duration: over.duration ?? "REGULAR",
      fullTime: over.fullTime ?? { home: null, away: null },
      halfTime: { home: null, away: null },
      ...(over.regularTime ? { regularTime: over.regularTime } : {}),
    },
  };
}

function makeUser(db: Db, name: string) {
  return db
    .insert(users)
    .values({
      id: randomUUID(),
      email: `${name.toLowerCase()}@test.co`,
      displayName: name,
      createdAt: T0,
    })
    .returning()
    .get();
}

describe("full polla lifecycle: sync → join → predict → finish → leaderboard", () => {
  let db: Db;
  let ana: string, beto: string, caro: string;
  let groupId: string;
  let matchId: number;

  beforeEach(() => {
    db = createDb(":memory:");
    ana = makeUser(db, "Ana").id;
    beto = makeUser(db, "Beto").id;
    caro = makeUser(db, "Caro").id;

    const group = createGroup(db, ana, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: true },
    });
    groupId = group.id;

    // friends join through the invite code, like the /join/[code] page does
    const found = getGroupByInviteCode(db, ` ${group.inviteCode.toLowerCase()} `);
    expect(found?.id).toBe(groupId);
    joinGroup(db, beto, found!.id, T0);
    joinGroup(db, caro, found!.id, T0);
    expect(getGroupMembers(db, groupId)).toHaveLength(3);

    // fixture arrives from the API as TIMED
    const res = upsertMatches(db, [fdMatch({ id: 1001, status: "TIMED" })], T0);
    expect(res.upserted).toBe(1);
    matchId = db.select().from(matches).where(eq(matches.fdId, 1001)).get()!.id;
  });

  it("scores the match per preset, applies único acertado, ranks the table", () => {
    savePrediction(db, { userId: ana, groupId, matchId, predHome: 2, predAway: 1 }, T0);
    savePrediction(db, { userId: beto, groupId, matchId, predHome: 1, predAway: 0 }, T0);
    savePrediction(db, { userId: caro, groupId, matchId, predHome: 0, predAway: 0 }, T0);

    const res = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: 2, away: 1 } })],
      AFTER_MATCH,
    );
    expect(res.resultsChanged).toEqual([matchId]);

    rebuildGroupScores(db, groupId, AFTER_MATCH);
    const board = getLeaderboard(db, groupId);

    // clásica: exact 3 (+5 único, Ana alone) / outcome 1 + goal-diff 1 / miss 0
    expect(board.map((r) => [r.displayName, r.total])).toEqual([
      ["Ana", 8],
      ["Beto", 2],
      ["Caro", 0],
    ]);
    expect(board[0].exactCount).toBe(1);
    expect(board[1].resultCount).toBe(1);
  });

  it("no único bonus when two people hit the exact score", () => {
    savePrediction(db, { userId: ana, groupId, matchId, predHome: 2, predAway: 1 }, T0);
    savePrediction(db, { userId: beto, groupId, matchId, predHome: 2, predAway: 1 }, T0);

    upsertMatches(db, [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: 2, away: 1 } })], AFTER_MATCH);
    rebuildGroupScores(db, groupId, AFTER_MATCH);

    const board = getLeaderboard(db, groupId);
    expect(board.find((r) => r.displayName === "Ana")!.total).toBe(3);
    expect(board.find((r) => r.displayName === "Beto")!.total).toBe(3);
  });

  it("locks predictions exactly at kickoff", () => {
    expect(() =>
      savePrediction(db, { userId: ana, groupId, matchId, predHome: 1, predAway: 0 }, KICKOFF),
    ).toThrow(PredictionLockedError);
  });

  it("stale API snapshots never regress a finished result or the table", () => {
    savePrediction(db, { userId: ana, groupId, matchId, predHome: 2, predAway: 1 }, T0);
    upsertMatches(db, [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: 2, away: 1 } })], AFTER_MATCH);
    rebuildGroupScores(db, groupId, AFTER_MATCH);

    // a cached list response flaps back to IN_PLAY 1-1, then FINISHED with nulls
    const flap1 = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "IN_PLAY", fullTime: { home: 1, away: 1 } })],
      new Date(AFTER_MATCH.getTime() + 60_000),
    );
    const flap2 = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: null, away: null } })],
      new Date(AFTER_MATCH.getTime() + 120_000),
    );
    expect(flap1.skippedStale).toBe(1);
    expect(flap2.skippedStale).toBe(1);

    const row = db.select().from(matches).where(eq(matches.id, matchId)).get()!;
    expect([row.status, row.regHome, row.regAway]).toEqual(["FINISHED", 2, 1]);

    rebuildAllScores(db, new Date(AFTER_MATCH.getTime() + 180_000));
    expect(getLeaderboard(db, groupId)[0].total).toBe(8); // 3 exact + 5 único
  });

  it("stale placeholder snapshots never wipe known team names", () => {
    // detail endpoint delivered the teams; the lagging list still has nulls
    const placeholder = fdMatch({ id: 1001, status: "TIMED" });
    placeholder.homeTeam = { ...placeholder.homeTeam, name: null };
    placeholder.awayTeam = { ...placeholder.awayTeam, name: null };
    const res = upsertMatches(db, [placeholder], new Date(T0.getTime() + 60_000));
    expect(res.skippedStale).toBe(1);
    const row = db.select().from(matches).where(eq(matches.id, matchId)).get()!;
    expect([row.homeTeam, row.awayTeam]).toEqual(["Mexico", "Colombia"]);
  });

  it("a SUSPENDED glitch with null scores can't erase a finished result", () => {
    upsertMatches(db, [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: 2, away: 1 } })], AFTER_MATCH);
    const res = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "SUSPENDED", fullTime: { home: null, away: null } })],
      new Date(AFTER_MATCH.getTime() + 60_000),
    );
    expect(res.skippedStale).toBe(1);
    const row = db.select().from(matches).where(eq(matches.id, matchId)).get()!;
    expect([row.status, row.regHome, row.regAway]).toEqual(["FINISHED", 2, 1]);
  });

  it("live goals don't trigger score rebuilds; the final whistle does", () => {
    const inPlay = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "IN_PLAY", fullTime: { home: 1, away: 0 } })],
      KICKOFF,
    );
    expect(inPlay.resultsChanged).toEqual([]); // mid-game — nothing to rescore
    const finished = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: 2, away: 1 } })],
      AFTER_MATCH,
    );
    expect(finished.resultsChanged).toEqual([matchId]);
  });

  it("an AWARDED walkover scores like a finished match", () => {
    savePrediction(db, { userId: ana, groupId, matchId, predHome: 3, predAway: 0 }, T0);
    upsertMatches(db, [fdMatch({ id: 1001, status: "AWARDED", fullTime: { home: 3, away: 0 } })], AFTER_MATCH);
    rebuildGroupScores(db, groupId, AFTER_MATCH);
    expect(getLeaderboard(db, groupId)[0].total).toBe(8); // exact 3 + único 5
  });

  it("manual override wins over the API until released", () => {
    db.update(matches)
      .set({ manualOverride: true, status: "FINISHED", regHome: 5, regAway: 0, finalHome: 5, finalAway: 0 })
      .where(eq(matches.id, matchId))
      .run();
    const res = upsertMatches(
      db,
      [fdMatch({ id: 1001, status: "FINISHED", fullTime: { home: 2, away: 1 } })],
      AFTER_MATCH,
    );
    expect(res.skippedOverridden).toBe(1);
    expect(db.select().from(matches).where(eq(matches.id, matchId)).get()!.regHome).toBe(5);
  });
});

describe("knockout matches score on regulation time", () => {
  it("extra-time final: predictions compare against the 90-minute score", () => {
    const db = createDb(":memory:");
    const ana = makeUser(db, "Ana").id;
    const beto = makeUser(db, "Beto").id;
    const group = createGroup(db, ana, {
      name: "Final",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    joinGroup(db, beto, group.id, T0);

    upsertMatches(db, [fdMatch({ id: 2001, status: "TIMED", stage: "FINAL", matchday: null })], T0);
    const matchId = db.select().from(matches).where(eq(matches.fdId, 2001)).get()!.id;

    savePrediction(db, { userId: ana, groupId: group.id, matchId, predHome: 2, predAway: 2 }, T0);
    savePrediction(db, { userId: beto, groupId: group.id, matchId, predHome: 3, predAway: 2 }, T0);

    // 2-2 after 90', 3-2 after extra time
    upsertMatches(
      db,
      [
        fdMatch({
          id: 2001,
          status: "FINISHED",
          stage: "FINAL",
          matchday: null,
          duration: "EXTRA_TIME",
          fullTime: { home: 3, away: 2 },
          regularTime: { home: 2, away: 2 },
        }),
      ],
      AFTER_MATCH,
    );

    const row = db.select().from(matches).where(eq(matches.id, matchId)).get()!;
    expect([row.regHome, row.regAway, row.finalHome, row.finalAway]).toEqual([2, 2, 3, 2]);

    rebuildGroupScores(db, group.id, AFTER_MATCH);
    const board = getLeaderboard(db, group.id);
    // Ana's 2-2 is exact on regulation; Beto's 3-2 (the ET score!) earns nothing
    expect(board.find((r) => r.displayName === "Ana")!.total).toBe(3);
    expect(board.find((r) => r.displayName === "Beto")!.total).toBe(0);
  });
});

describe("recocha lifecycle: propose → vote → answer → resolve → points", () => {
  let db: Db;
  let ana: string, beto: string, caro: string, dario: string;
  let groupId: string;
  const LOCK = new Date("2026-06-14T20:00:00Z");

  beforeEach(() => {
    db = createDb(":memory:");
    ana = makeUser(db, "Ana").id;
    beto = makeUser(db, "Beto").id;
    caro = makeUser(db, "Caro").id;
    dario = makeUser(db, "Dario").id;
    const group = createGroup(db, ana, {
      name: "Parche",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    });
    groupId = group.id;
    for (const u of [beto, caro, dario]) joinGroup(db, u, groupId, T0);
  });

  it("quorum freezes at proposal time; majority approves; closest-wins pays out", () => {
    const q = proposeQuestion(
      db,
      { groupId, proposerId: beto, question: "¿Cuántos bailes de salsa choke?", answerType: "number", points: 4, lockAt: LOCK },
      T0,
    );
    expect(q.eligibleCount).toBe(4); // frozen
    expect(q.status).toBe("proposed"); // proposer's auto-vote is 1 of 3 needed

    // a fifth member joining later must not move the goalposts
    const emma = makeUser(db, "Emma").id;
    joinGroup(db, emma, groupId, T0);
    expect(getVoteTally(db, q).needed).toBe(3);

    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, T0);
    let tally = voteQuestion(db, { questionId: q.id, groupId, userId: caro, vote: "approve" }, T0);
    expect(tally.approvals).toBe(3);

    answerQuestion(db, { questionId: q.id, groupId, userId: beto, value: "7" }, T0);
    answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "10" }, T0);
    answerQuestion(db, { questionId: q.id, groupId, userId: caro, value: "3" }, T0);

    // can't resolve while open; can't answer once locked
    expect(() => resolveQuestion(db, { questionId: q.id, groupId, correctValue: "8" }, T0)).toThrow(PropStateError);
    expect(() => answerQuestion(db, { questionId: q.id, groupId, userId: dario, value: "5" }, LOCK)).toThrow(PropLockedError);

    resolveQuestion(db, { questionId: q.id, groupId, correctValue: "8", resolutionMode: "closest" }, LOCK);
    const board = getLeaderboard(db, groupId);
    expect(board.find((r) => r.displayName === "Beto")!.total).toBe(4); // |7-8| closest
    expect(board.find((r) => r.displayName === "Ana")!.total).toBe(0);
  });

  it("closest-wins ties pay everyone tied", () => {
    const q = proposeQuestion(
      db,
      { groupId, proposerId: ana, question: "¿Cuántas tarjetas amarillas?", answerType: "number", points: 3, lockAt: LOCK },
      T0,
    );
    voteQuestion(db, { questionId: q.id, groupId, userId: beto, vote: "approve" }, T0);
    voteQuestion(db, { questionId: q.id, groupId, userId: caro, vote: "approve" }, T0);
    answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "4" }, T0);
    answerQuestion(db, { questionId: q.id, groupId, userId: caro, value: "6" }, T0);
    resolveQuestion(db, { questionId: q.id, groupId, correctValue: "5", resolutionMode: "closest" }, LOCK);

    const board = getLeaderboard(db, groupId);
    expect(board.find((r) => r.displayName === "Ana")!.total).toBe(3);
    expect(board.find((r) => r.displayName === "Caro")!.total).toBe(3);
  });

  it("cross-group tampering: a questionId only works with its own group", () => {
    const q = proposeQuestion(
      db,
      { groupId, proposerId: ana, question: "¿Cuántos goles de cabeza?", answerType: "number", lockAt: LOCK },
      T0,
    );
    // attacker controls their own group and reuses the victim's questionId
    const mallory = makeUser(db, "Mallory").id;
    const evilGroup = createGroup(db, mallory, {
      name: "Evil",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }).id;

    expect(() =>
      voteQuestion(db, { questionId: q.id, groupId: evilGroup, userId: mallory, vote: "approve" }, T0),
    ).toThrow(PropStateError);

    voteQuestion(db, { questionId: q.id, groupId, userId: beto, vote: "approve" }, T0);
    voteQuestion(db, { questionId: q.id, groupId, userId: caro, vote: "approve" }, T0);

    expect(() =>
      answerQuestion(db, { questionId: q.id, groupId: evilGroup, userId: mallory, value: "2" }, T0),
    ).toThrow(PropStateError);
    expect(() =>
      resolveQuestion(db, { questionId: q.id, groupId: evilGroup, correctValue: "2" }, LOCK),
    ).toThrow(PropStateError);

    // the legitimate group still resolves fine
    answerQuestion(db, { questionId: q.id, groupId, userId: beto, value: "2" }, T0);
    expect(resolveQuestion(db, { questionId: q.id, groupId, correctValue: "2" }, LOCK).status).toBe("resolved");
  });

  it("majority rejection kills the question; nobody can answer it", () => {
    const q = proposeQuestion(
      db,
      { groupId, proposerId: ana, question: "¿Llora el comentarista?", answerType: "boolean", lockAt: LOCK },
      T0,
    );
    voteQuestion(db, { questionId: q.id, groupId, userId: beto, vote: "reject" }, T0);
    voteQuestion(db, { questionId: q.id, groupId, userId: caro, vote: "reject" }, T0);
    const tally = voteQuestion(db, { questionId: q.id, groupId, userId: dario, vote: "reject" }, T0);
    expect(tally.rejections).toBe(3);
    expect(() => answerQuestion(db, { questionId: q.id, groupId, userId: beto, value: "si" }, T0)).toThrow(PropStateError);
    // and once decided, votes are closed
    expect(() => voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, T0)).toThrow(PropStateError);
  });
});

describe("bonus picks: deadline, outcomes, case-insensitive matching", () => {
  it("pays champion + top scorer per preset after the admin sets outcomes", () => {
    const db = createDb(":memory:");
    const ana = makeUser(db, "Ana").id;
    const beto = makeUser(db, "Beto").id;
    const group = createGroup(db, ana, {
      name: "Familia",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    joinGroup(db, beto, group.id, T0);
    const deadline = new Date("2026-06-13T00:00:00Z");
    db.update(groups).set({ bonusLockAt: deadline }).where(eq(groups.id, group.id)).run();

    saveBonusPick(db, { userId: ana, groupId: group.id, category: "champion", value: "Colombia" }, T0);
    saveBonusPick(db, { userId: ana, groupId: group.id, category: "top_scorer", value: "James Rodríguez" }, T0);
    saveBonusPick(db, { userId: beto, groupId: group.id, category: "champion", value: "Argentina" }, T0);

    // after the deadline the picks are sealed
    expect(() =>
      saveBonusPick(db, { userId: beto, groupId: group.id, category: "champion", value: "Brazil" }, deadline),
    ).toThrow(BonusLockedError);

    setOutcome(db, "champion", "Colombia");
    setOutcome(db, "top_scorer", "JAMES RODRÍGUEZ"); // admin typed it differently
    rebuildGroupScores(db, group.id, AFTER_MATCH);

    const board = getLeaderboard(db, group.id);
    expect(board.find((r) => r.displayName === "Ana")!.total).toBe(10 + 6);
    expect(board.find((r) => r.displayName === "Beto")!.total).toBe(0);
  });
});

describe("joker integrity", () => {
  const LATER = new Date("2026-06-13T23:00:00Z"); // same matchday, later kickoff

  it("a joker spent on a locked match can't be doubled by a second one", () => {
    const db = createDb(":memory:");
    const ana = makeUser(db, "Ana").id;
    const groupId = createGroup(db, ana, {
      name: "G",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    }).id;
    upsertMatches(db, [fdMatch({ id: 1, status: "TIMED" })], T0);
    upsertMatches(db, [fdMatch({ id: 2, status: "TIMED", utcDate: "2026-06-14T02:00:00Z" })], T0);
    const m1 = db.select().from(matches).where(eq(matches.fdId, 1)).get()!.id;
    const m2 = db.select().from(matches).where(eq(matches.fdId, 2)).get()!.id;

    savePrediction(db, { userId: ana, groupId, matchId: m1, predHome: 2, predAway: 1, joker: true, allowJoker: true }, T0);
    // m1 kicked off — its joker is locked in; trying to joker m2 is score-only
    savePrediction(db, { userId: ana, groupId, matchId: m2, predHome: 1, predAway: 0, joker: true, allowJoker: true }, LATER);

    const mine = getUserPredictionsForTest(db, ana, groupId);
    expect(mine.get(m1)?.joker).toBe(true);
    expect(mine.get(m2)?.joker).toBe(false);
  });

  it("'apply to all pollas' preserves the joker set in another group", () => {
    const db = createDb(":memory:");
    const ana = makeUser(db, "Ana").id;
    const gA = createGroup(db, ana, { name: "A", scoringRules: { preset: "clasica", unicoAcertado: false } }).id;
    const gB = createGroup(db, ana, { name: "B", scoringRules: { preset: "escalonada", unicoAcertado: false } }).id;
    upsertMatches(db, [fdMatch({ id: 5, status: "TIMED" })], T0);
    const m = db.select().from(matches).where(eq(matches.fdId, 5)).get()!.id;

    // joker lives in polla B
    savePrediction(db, { userId: ana, groupId: gB, matchId: m, predHome: 2, predAway: 1, joker: true, allowJoker: true }, T0);

    // user updates the score from polla A with "apply to all"
    savePredictionForGroups(
      db,
      {
        userId: ana,
        matchId: m,
        predHome: 3,
        predAway: 1,
        groups: [
          { groupId: gA, joker: false, allowJoker: false },
          { groupId: gB, joker: false, allowJoker: false, preserveJoker: true },
        ],
      },
      T0,
    );

    const inB = getUserPredictionsForTest(db, ana, gB).get(m)!;
    expect([inB.predHome, inB.predAway, inB.joker]).toEqual([3, 1, true]);
  });
});

describe("multi-polla: one pick, each group scores by its own rules", () => {
  it("applies the score everywhere, joker only at origin, presets diverge", () => {
    const db = createDb(":memory:");
    const ana = makeUser(db, "Ana").id;
    const g1 = createGroup(db, ana, {
      name: "Escalonada",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    }).id;
    const g2 = createGroup(db, ana, {
      name: "Clásica",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }).id;

    upsertMatches(db, [fdMatch({ id: 3001, status: "TIMED" })], T0);
    const matchId = db.select().from(matches).where(eq(matches.fdId, 3001)).get()!.id;

    savePredictionForGroups(
      db,
      {
        userId: ana,
        matchId,
        predHome: 2,
        predAway: 1,
        groups: [
          { groupId: g1, joker: true, allowJoker: true },
          { groupId: g2, joker: true, allowJoker: false }, // clasica has no joker
        ],
      },
      T0,
    );

    upsertMatches(db, [fdMatch({ id: 3001, status: "FINISHED", fullTime: { home: 2, away: 1 } })], AFTER_MATCH);
    rebuildAllScores(db, AFTER_MATCH);

    // escalonada exact 10, doubled by the joker; clásica exact 3, no joker
    expect(getLeaderboard(db, g1)[0].total).toBe(20);
    expect(getLeaderboard(db, g2)[0].total).toBe(3);
  });
});

describe("datetime-local deadlines anchor to the submitter's timezone", () => {
  it("round-trips Bogotá and Berlin wall clocks through UTC", () => {
    const bog = parseDatetimeLocal("2026-06-11T18:00", "America/Bogota")!;
    expect(bog.toISOString()).toBe("2026-06-11T23:00:00.000Z"); // UTC-5
    expect(formatDatetimeLocal(bog, "America/Bogota")).toBe("2026-06-11T18:00");

    const ber = parseDatetimeLocal("2026-06-11T18:00", "Europe/Berlin")!;
    expect(ber.toISOString()).toBe("2026-06-11T16:00:00.000Z"); // CEST, UTC+2

    expect(parseDatetimeLocal("garbage", "America/Bogota")).toBeNull();
  });
});
