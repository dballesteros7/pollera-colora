import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, matches, scores } from "../lib/db/schema";
import { createGroup, joinGroup } from "../lib/groups";
import { savePrediction } from "../lib/predictions";
import { PRESETS } from "../lib/scoring/presets";
import { scoreMatch, rebuildGroupScores } from "../lib/scoring/score";

const clasica = PRESETS.clasica;
const audaz = PRESETS.marcador_o_nada;
const escalonada = PRESETS.escalonada;

const groupStage = (regHome: number, regAway: number) => ({
  regHome,
  regAway,
  stage: "GROUP_STAGE",
});

describe("scoreMatch — clásica", () => {
  it("exact score → 3, not 3+1", () => {
    const s = scoreMatch(
      { predHome: 2, predAway: 1, joker: false },
      groupStage(2, 1),
      clasica,
    );
    expect(s).toEqual({ points: 3, exact: true, result: true });
  });

  it("right winner, right goal diff → 1+1", () => {
    const s = scoreMatch(
      { predHome: 3, predAway: 2, joker: false },
      groupStage(2, 1),
      clasica,
    );
    expect(s).toEqual({ points: 2, exact: false, result: true });
  });

  it("right winner, wrong goal diff → 1", () => {
    expect(
      scoreMatch({ predHome: 3, predAway: 1, joker: false }, groupStage(2, 1), clasica)
        .points,
    ).toBe(1);
  });

  it("non-exact draw → 1 (no goal-diff bonus for draws)", () => {
    expect(
      scoreMatch({ predHome: 2, predAway: 2, joker: false }, groupStage(0, 0), clasica)
        .points,
    ).toBe(1);
  });

  it("wrong outcome → 0", () => {
    expect(
      scoreMatch({ predHome: 0, predAway: 1, joker: false }, groupStage(2, 1), clasica)
        .points,
    ).toBe(0);
  });

  it("joker has no effect when the preset has none", () => {
    expect(
      scoreMatch({ predHome: 2, predAway: 1, joker: true }, groupStage(2, 1), clasica)
        .points,
    ).toBe(3);
  });
});

describe("scoreMatch — marcador o nada", () => {
  it("exact in the final → 10 × 3", () => {
    const s = scoreMatch(
      { predHome: 1, predAway: 0, joker: false },
      { regHome: 1, regAway: 0, stage: "FINAL" },
      audaz,
    );
    expect(s.points).toBe(30);
  });

  it("result in a quarter → 4 × 2", () => {
    const s = scoreMatch(
      { predHome: 2, predAway: 0, joker: false },
      { regHome: 1, regAway: 0, stage: "QUARTER_FINALS" },
      audaz,
    );
    expect(s.points).toBe(8);
  });

  it("half multipliers round (1.5 × 4 = 6)", () => {
    const s = scoreMatch(
      { predHome: 2, predAway: 0, joker: false },
      { regHome: 1, regAway: 0, stage: "LAST_16" },
      audaz,
    );
    expect(s.points).toBe(6);
  });

  it("no goal-diff bonus in this preset", () => {
    expect(
      scoreMatch({ predHome: 3, predAway: 2, joker: false }, groupStage(2, 1), audaz)
        .points,
    ).toBe(4);
  });
});

describe("scoreMatch — escalonada", () => {
  it("exact → 10, no extra team-goal bonus", () => {
    expect(
      scoreMatch({ predHome: 2, predAway: 1, joker: false }, groupStage(2, 1), escalonada)
        .points,
    ).toBe(10);
  });

  it("winner + goal diff → 5, +1 if a team's goals match", () => {
    // 3-2 vs real 2-1: same diff, away goals differ, home differ → 5
    expect(
      scoreMatch({ predHome: 3, predAway: 2, joker: false }, groupStage(2, 1), escalonada)
        .points,
    ).toBe(5);
    // 2-0 vs real 2-1: winner right, diff wrong, home goals match → 2+1
    expect(
      scoreMatch({ predHome: 2, predAway: 0, joker: false }, groupStage(2, 1), escalonada)
        .points,
    ).toBe(3);
  });

  it("wrong outcome but one team's goals right → 1", () => {
    expect(
      scoreMatch({ predHome: 0, predAway: 1, joker: false }, groupStage(2, 1), escalonada)
        .points,
    ).toBe(1);
  });

  it("joker doubles", () => {
    expect(
      scoreMatch({ predHome: 2, predAway: 1, joker: true }, groupStage(2, 1), escalonada)
        .points,
    ).toBe(20);
  });
});

describe("rebuildGroupScores", () => {
  let db: Db;
  const NOW = new Date("2026-06-11T20:00:00Z");
  const KICKOFF = new Date("2026-06-12T19:00:00Z");
  const AFTER = new Date("2026-06-12T22:00:00Z");

  function makeUser(email: string) {
    return db
      .insert(users)
      .values({ id: randomUUID(), email, createdAt: NOW })
      .returning()
      .get();
  }

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("accumulates match points, exact counts, and único bonus", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const group = createGroup(db, ana.id, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: true },
    });
    joinGroup(db, beto.id, group.id, NOW);

    const m = db
      .insert(matches)
      .values({
        fdId: 1,
        stage: "GROUP_STAGE",
        matchday: 1,
        kickoffUtc: KICKOFF,
        homeTeam: "Mexico",
        awayTeam: "Colombia",
        status: "TIMED",
        updatedAt: NOW,
      })
      .returning()
      .get();

    savePrediction(db, { userId: ana.id, groupId: group.id, matchId: m.id, predHome: 1, predAway: 2 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: group.id, matchId: m.id, predHome: 0, predAway: 3 }, NOW);

    db.update(matches)
      .set({ status: "FINISHED", duration: "REGULAR", regHome: 1, regAway: 2, finalHome: 1, finalAway: 2 })
      .where(eq(matches.id, m.id))
      .run();

    rebuildGroupScores(db, group.id, AFTER);

    const rows = db.select().from(scores).all();
    const anaRow = rows.find((r) => r.userId === ana.id)!;
    const betoRow = rows.find((r) => r.userId === beto.id)!;
    // ana: exact (3) + único (5) = 8
    expect(anaRow.pointsMatches).toBe(8);
    expect(anaRow.exactCount).toBe(1);
    // beto (0-3 vs 1-2): right winner, wrong goal diff = 1
    expect(betoRow.pointsMatches).toBe(1);
    expect(betoRow.resultCount).toBe(1);
  });

  it("no único bonus when two people hit the exact score", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const group = createGroup(db, ana.id, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: true },
    });
    joinGroup(db, beto.id, group.id, NOW);

    const m = db
      .insert(matches)
      .values({
        fdId: 2,
        stage: "GROUP_STAGE",
        matchday: 1,
        kickoffUtc: KICKOFF,
        homeTeam: "A",
        awayTeam: "B",
        status: "TIMED",
        updatedAt: NOW,
      })
      .returning()
      .get();

    for (const u of [ana, beto]) {
      savePrediction(db, { userId: u.id, groupId: group.id, matchId: m.id, predHome: 2, predAway: 0 }, NOW);
    }
    db.update(matches)
      .set({ status: "FINISHED", regHome: 2, regAway: 0, finalHome: 2, finalAway: 0 })
      .where(eq(matches.id, m.id))
      .run();

    rebuildGroupScores(db, group.id, AFTER);
    for (const r of db.select().from(scores).all()) {
      expect(r.pointsMatches).toBe(3);
    }
  });

  it("rebuild is idempotent", () => {
    const ana = makeUser("ana@b.co");
    const group = createGroup(db, ana.id, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    rebuildGroupScores(db, group.id, AFTER);
    rebuildGroupScores(db, group.id, AFTER);
    expect(db.select().from(scores).all()).toHaveLength(1);
  });
});
