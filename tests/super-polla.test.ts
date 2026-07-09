import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, matches, scores, memberships } from "../lib/db/schema";
import { createGroup, joinGroup, getUserGroups } from "../lib/groups";
import { savePrediction } from "../lib/predictions";
import { saveBonusPick } from "../lib/bonus";
import {
  ensureSuperPolla,
  getSuperPolla,
  getSuperEffectivePicks,
  effectiveSuperBonusByUser,
  getSuperIdentity,
  regularPollaIdsOf,
  setSuperIdentity,
  superLeaderboard,
  syncSuperPollaMembership,
} from "../lib/super-polla";
import { rebuildSuperPollaScores, rebuildAllScores } from "../lib/scoring/score";
import { FAMOUS_ALIASES } from "../lib/anon";

const NOW = new Date("2026-06-11T20:00:00Z");
const KICKOFF = new Date("2026-07-04T19:00:00Z");
const AFTER = new Date("2026-07-04T22:00:00Z");

describe("súper polla", () => {
  let db: Db;
  let fd = 0;

  function makeUser(email: string, createdAt = NOW) {
    return db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        displayName: email.split("@")[0],
        createdAt,
      })
      .returning()
      .get();
  }

  // a finished match in `stage` with regulation score regHome–regAway
  function finishedMatch(stage: string, regHome: number, regAway: number) {
    const m = db
      .insert(matches)
      .values({
        fdId: ++fd,
        stage,
        kickoffUtc: KICKOFF,
        homeTeam: "Mexico",
        awayTeam: "Colombia",
        status: "FINISHED",
        duration: "REGULAR",
        regHome,
        regAway,
        finalHome: regHome,
        finalAway: regAway,
        updatedAt: NOW,
      })
      .returning()
      .get();
    return m;
  }

  function superMemberIds(): string[] {
    const sp = getSuperPolla(db)!;
    return db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.groupId, sp.id))
      .all()
      .map((r) => r.userId);
  }

  function superScore(userId: string) {
    const sp = getSuperPolla(db)!;
    return db
      .select()
      .from(scores)
      .where(and(eq(scores.userId, userId), eq(scores.groupId, sp.id)))
      .get();
  }

  beforeEach(() => {
    db = createDb(":memory:");
    fd = 0;
  });

  it("is a single idempotent singleton, created once a user exists", () => {
    expect(getSuperPolla(db)).toBeNull();
    makeUser("a@b.co");
    const first = ensureSuperPolla(db, NOW)!;
    const second = ensureSuperPolla(db, NOW)!;
    expect(first.id).toBe(second.id);
    expect(first.isSuper).toBe(true);
  });

  it("auto-enrolls every active player and no one else", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const loner = makeUser("loner@b.co"); // never joins a polla

    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    joinGroup(db, beto.id, polla.id, NOW);

    const ids = superMemberIds();
    expect(ids).toContain(ana.id);
    expect(ids).toContain(beto.id);
    expect(ids).not.toContain(loner.id);
  });

  it("scores only knockout matches, reusing home-polla picks under Marcador o nada", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      // clásica home polla — the súper polla re-scores under marcador o nada
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    joinGroup(db, beto.id, polla.id, NOW);

    const groupGame = finishedMatch("GROUP_STAGE", 1, 0);
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);

    // both nail the group game exactly (must NOT count in the súper polla)
    savePrediction(db, { userId: ana.id, groupId: polla.id, matchId: groupGame.id, predHome: 1, predAway: 0 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: polla.id, matchId: groupGame.id, predHome: 1, predAway: 0 }, NOW);
    // QF: ana exact (2-1), beto right winner only (3-1)
    savePrediction(db, { userId: ana.id, groupId: polla.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: polla.id, matchId: quarter.id, predHome: 3, predAway: 1 }, NOW);

    rebuildSuperPollaScores(db, AFTER);

    // marcador o nada: exact 10, result 4, QF multiplier ×2
    expect(superScore(ana.id)!.pointsMatches).toBe(20); // 10 × 2
    expect(superScore(ana.id)!.exactCount).toBe(1);
    expect(superScore(beto.id)!.pointsMatches).toBe(8); // 4 × 2
    expect(superScore(beto.id)!.exactCount).toBe(0);
  });

  it("an inherited pick never brings its home-polla comodín along", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    });
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);
    // exact pick with the joker on it in the home polla (no súper pick yet):
    // the pick falls through, the joker stays home (it doubles only there)
    savePrediction(
      db,
      { userId: ana.id, groupId: polla.id, matchId: quarter.id, predHome: 2, predAway: 1, joker: true, allowJoker: true },
      NOW,
    );

    rebuildSuperPollaScores(db, AFTER);

    // exact 10 × QF multiplier 2 — no joker doubling
    expect(superScore(ana.id)!.pointsMatches).toBe(20);
  });

  it("a home joker can't double-dip next to an own súper comodín in the same round", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    });
    const sp = getSuperPolla(db)!;
    const qfA = finishedMatch("QUARTER_FINALS", 2, 1);
    const qfB = finishedMatch("QUARTER_FINALS", 1, 0);

    // own súper comodín on match A (exact), home-polla joker on match B (exact)
    savePrediction(
      db,
      { userId: ana.id, groupId: sp.id, matchId: qfA.id, predHome: 2, predAway: 1, joker: true, allowJoker: true },
      NOW,
    );
    savePrediction(
      db,
      { userId: ana.id, groupId: polla.id, matchId: qfB.id, predHome: 1, predAway: 0, joker: true, allowJoker: true },
      NOW,
    );

    rebuildSuperPollaScores(db, AFTER);

    // A: exact 10 × QF 2 × comodín 2 = 40; B falls through jokerless: 10 × 2 = 20
    expect(superScore(ana.id)!.pointsMatches).toBe(60);
  });

  it("a súper-polla pick overrides the home-polla copy", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    const sp = getSuperPolla(db)!;
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);

    // home pick is exact (would be 20), but the súper pick is wrong → 0 wins
    savePrediction(db, { userId: ana.id, groupId: polla.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: ana.id, groupId: sp.id, matchId: quarter.id, predHome: 0, predAway: 0 }, NOW);

    rebuildSuperPollaScores(db, AFTER);
    expect(superScore(ana.id)!.pointsMatches).toBe(0);
  });

  it("a comodín set on a súper pick doubles that match", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    const sp = getSuperPolla(db)!;
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);

    // exact súper pick with the comodín on it (the home polla has no joker)
    savePrediction(
      db,
      { userId: ana.id, groupId: sp.id, matchId: quarter.id, predHome: 2, predAway: 1, joker: true, allowJoker: true },
      NOW,
    );

    rebuildSuperPollaScores(db, AFTER);
    // exact 10 × QF 2 × comodín 2 = 40
    expect(superScore(ana.id)!.pointsMatches).toBe(40);
  });

  it("uses the earliest-joined polla for players in multiple pollas", () => {
    const ana = makeUser("ana@b.co");
    const otro = makeUser("otro@b.co");
    const first = createGroup(db, ana.id, {
      name: "Primera",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    // a second polla owned by someone else, which ana joins later
    const second = createGroup(db, otro.id, {
      name: "Segunda",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    joinGroup(db, ana.id, second.id, new Date("2026-06-12T20:00:00Z"));

    expect(regularPollaIdsOf(db, ana.id)).toEqual([first.id, second.id]);

    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);
    // exact in the home polla, wrong in the later one — home polla must win out
    savePrediction(db, { userId: ana.id, groupId: first.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: ana.id, groupId: second.id, matchId: quarter.id, predHome: 0, predAway: 0 }, NOW);

    rebuildSuperPollaScores(db, AFTER);

    expect(superScore(ana.id)!.pointsMatches).toBe(20); // exact from `first`, ×2
    expect(superScore(ana.id)!.exactCount).toBe(1);
  });

  it("falls back to a later polla for matches the earliest one never picked", () => {
    const ana = makeUser("ana@b.co");
    const otro = makeUser("otro@b.co");
    createGroup(db, ana.id, {
      name: "Primera",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    const second = createGroup(db, otro.id, {
      name: "Segunda",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    joinGroup(db, ana.id, second.id, new Date("2026-06-12T20:00:00Z"));

    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);
    // ana only plays in the later polla — those bets must still count here
    savePrediction(db, { userId: ana.id, groupId: second.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);

    rebuildSuperPollaScores(db, AFTER);
    expect(superScore(ana.id)!.pointsMatches).toBe(20); // exact ×2 from `second`
  });

  it("getUserGroups never returns the súper polla", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    const mine = getUserGroups(db, ana.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].group.id).toBe(polla.id);
    // but she IS enrolled in the súper polla under the hood
    expect(superMemberIds()).toContain(ana.id);
  });

  // a viewer (ana) with a pollamate (beto) and a stranger (carlos in another polla)
  function threeWayBoard() {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const carlos = makeUser("carlos@b.co");
    const pollaA = createGroup(db, ana.id, {
      name: "A",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    joinGroup(db, beto.id, pollaA.id, NOW); // beto shares a polla with ana
    createGroup(db, carlos.id, {
      name: "B",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }); // carlos is a stranger to ana
    return { ana, beto, carlos };
  }

  it("masks strangers with a famous alias; pollamates and self keep real names", () => {
    const { ana, beto, carlos } = threeWayBoard();
    const board = superLeaderboard(db, ana.id);
    const row = (id: string) => board.find((r) => r.userId === id)!;

    expect(row(ana.id)).toMatchObject({ name: "ana", masked: false, isYou: true });
    expect(row(beto.id)).toMatchObject({ name: "beto", masked: false });

    const c = row(carlos.id);
    expect(c.masked).toBe(true);
    expect(c.name).not.toBe("carlos");
    expect(FAMOUS_ALIASES as readonly string[]).toContain(c.name);
  });

  it("a chosen 'real' identity reveals the name to everyone", () => {
    const { ana, carlos } = threeWayBoard();
    setSuperIdentity(db, carlos.id, "real", null);
    const c = superLeaderboard(db, ana.id).find((r) => r.userId === carlos.id)!;
    expect(c.name).toBe("carlos");
    expect(c.masked).toBe(false);
    expect(getSuperIdentity(db, carlos.id)?.mode).toBe("real");
  });

  it("a nickname is shown to everyone, even pollamates", () => {
    const { ana, beto, carlos } = threeWayBoard();
    setSuperIdentity(db, beto.id, "nickname", "El Tigre");
    // ana shares a polla with beto, yet sees the chosen nickname
    const fromAna = superLeaderboard(db, ana.id).find((r) => r.userId === beto.id)!;
    expect(fromAna).toMatchObject({ name: "El Tigre", masked: false });
    // a stranger sees the nickname too (not a famous alias)
    const fromCarlos = superLeaderboard(db, carlos.id).find((r) => r.userId === beto.id)!;
    expect(fromCarlos).toMatchObject({ name: "El Tigre", masked: false });
  });

  it("getSuperEffectivePicks merges own súper picks with the home-polla fallback", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    joinGroup(db, beto.id, polla.id, NOW);
    const sp = getSuperPolla(db)!;
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);

    // ana only picked in her home polla; beto picked in both (súper must win)
    savePrediction(db, { userId: ana.id, groupId: polla.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: polla.id, matchId: quarter.id, predHome: 0, predAway: 0 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: sp.id, matchId: quarter.id, predHome: 3, predAway: 1 }, NOW);

    const picks = getSuperEffectivePicks(db, [quarter.id]).get(quarter.id)!;
    const byUser = new Map(picks.map((p) => [p.userId, p]));
    expect(byUser.get(ana.id)).toMatchObject({ predHome: 2, predAway: 1, fromHome: true });
    expect(byUser.get(beto.id)).toMatchObject({ predHome: 3, predAway: 1, fromHome: false });
    expect(picks).toHaveLength(2);
  });

  it("getSuperEffectivePicks shows picks made only in a later polla, earliest polla winning", () => {
    const ana = makeUser("ana@b.co");
    const otro = makeUser("otro@b.co");
    const first = createGroup(db, ana.id, {
      name: "Primera",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    const second = createGroup(db, otro.id, {
      name: "Segunda",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    joinGroup(db, ana.id, second.id, new Date("2026-06-12T20:00:00Z"));
    expect(regularPollaIdsOf(db, ana.id)).toEqual([first.id, second.id]);

    const qfA = finishedMatch("QUARTER_FINALS", 2, 1);
    const qfB = finishedMatch("QUARTER_FINALS", 1, 0);
    // A picked only in the later polla — displayed (and scored) from there;
    // B picked in both — the earliest polla wins
    savePrediction(db, { userId: ana.id, groupId: second.id, matchId: qfA.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: ana.id, groupId: first.id, matchId: qfB.id, predHome: 1, predAway: 0 }, NOW);
    savePrediction(db, { userId: ana.id, groupId: second.id, matchId: qfB.id, predHome: 3, predAway: 3 }, NOW);

    const forA = getSuperEffectivePicks(db, [qfA.id, qfB.id]).get(qfA.id) ?? [];
    expect(forA.find((p) => p.userId === ana.id)).toMatchObject({ predHome: 2, predAway: 1, fromHome: true });
    const forB = getSuperEffectivePicks(db, [qfA.id, qfB.id]).get(qfB.id) ?? [];
    expect(forB.find((p) => p.userId === ana.id)).toMatchObject({ predHome: 1, predAway: 0, fromHome: true });
  });

  it("getSuperEffectivePicks strips inherited jokers but keeps own súper ones", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    });
    const sp = getSuperPolla(db)!;
    const qfA = finishedMatch("QUARTER_FINALS", 2, 1);
    const qfB = finishedMatch("QUARTER_FINALS", 1, 0);
    savePrediction(
      db,
      { userId: ana.id, groupId: polla.id, matchId: qfA.id, predHome: 2, predAway: 1, joker: true, allowJoker: true },
      NOW,
    );
    savePrediction(
      db,
      { userId: ana.id, groupId: sp.id, matchId: qfB.id, predHome: 1, predAway: 0, joker: true, allowJoker: true },
      NOW,
    );

    const inherited = getSuperEffectivePicks(db, [qfA.id, qfB.id]).get(qfA.id)!;
    expect(inherited[0]).toMatchObject({ userId: ana.id, joker: false, fromHome: true });
    const own = getSuperEffectivePicks(db, [qfA.id, qfB.id]).get(qfB.id)!;
    expect(own[0]).toMatchObject({ userId: ana.id, joker: true, fromHome: false });
  });

  it("bonus picks fall back across pollas, own súper pick first", () => {
    const ana = makeUser("ana@b.co");
    const otro = makeUser("otro@b.co");
    createGroup(db, ana.id, {
      name: "Primera",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    const second = createGroup(db, otro.id, {
      name: "Segunda",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }, NOW);
    joinGroup(db, ana.id, second.id, new Date("2026-06-12T20:00:00Z"));
    const sp = getSuperPolla(db)!;

    // champion set only in the later polla; top scorer set in the súper polla
    saveBonusPick(db, { userId: ana.id, groupId: second.id, category: "champion", value: "Colombia" }, NOW);
    saveBonusPick(db, { userId: ana.id, groupId: sp.id, category: "top_scorer", value: "Luis Díaz" }, NOW);

    const mine = effectiveSuperBonusByUser(db).get(ana.id)!;
    expect(mine.get("champion")).toEqual({ value: "Colombia", fromHome: true });
    expect(mine.get("top_scorer")).toEqual({ value: "Luis Díaz", fromHome: false });
  });

  it("rebuildAllScores refreshes the súper polla without scoring its own group", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);
    savePrediction(db, { userId: ana.id, groupId: polla.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);

    rebuildAllScores(db, AFTER);

    expect(superScore(ana.id)!.pointsMatches).toBe(20);
    // and there are no súper-polla-scoped predictions feeding it
    syncSuperPollaMembership(db, AFTER);
  });
});
