import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, matches, scores, memberships } from "../lib/db/schema";
import { createGroup, joinGroup, getUserGroups } from "../lib/groups";
import { savePrediction } from "../lib/predictions";
import {
  ensureSuperPolla,
  getSuperPolla,
  getSuperIdentity,
  homePollaIdOf,
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

  it("falls back to the home-polla joker until a súper pick is made", () => {
    const ana = makeUser("ana@b.co");
    const polla = createGroup(db, ana.id, {
      name: "Oficina",
      scoringRules: { preset: "escalonada", unicoAcertado: false },
    });
    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);
    // exact pick with the joker on it in the home polla (no súper pick yet)
    savePrediction(
      db,
      { userId: ana.id, groupId: polla.id, matchId: quarter.id, predHome: 2, predAway: 1, joker: true, allowJoker: true },
      NOW,
    );

    rebuildSuperPollaScores(db, AFTER);

    // exact 10 × QF multiplier 2 × joker 2 = 40
    expect(superScore(ana.id)!.pointsMatches).toBe(40);
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

    expect(homePollaIdOf(db, ana.id)).toBe(first.id);

    const quarter = finishedMatch("QUARTER_FINALS", 2, 1);
    // exact in the home polla, wrong in the later one — home polla must win out
    savePrediction(db, { userId: ana.id, groupId: first.id, matchId: quarter.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: ana.id, groupId: second.id, matchId: quarter.id, predHome: 0, predAway: 0 }, NOW);

    rebuildSuperPollaScores(db, AFTER);

    expect(superScore(ana.id)!.pointsMatches).toBe(20); // exact from `first`, ×2
    expect(superScore(ana.id)!.exactCount).toBe(1);
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
