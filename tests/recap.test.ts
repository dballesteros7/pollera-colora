import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, matches, predictions, memberships } from "../lib/db/schema";
import { createGroup, joinGroup } from "../lib/groups";
import { savePrediction } from "../lib/predictions";
import type { ScoringRules } from "../lib/scoring/presets";
import {
  listRounds,
  getRound,
  getRoundRecapForUser,
  getGlobalRoundStanding,
  getPredictionBuddy,
  getPredictionBuddies,
  featuredRecapRound,
  recapTabAvailable,
  FAMOUS_ALIASES,
} from "../lib/recap";

const NOW = new Date("2026-06-11T00:00:00Z");

let db: Db;
let fd = 0;

function makeUser(email: string, opts: { isBot?: boolean; name?: string } = {}) {
  return db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      displayName: opts.name ?? email.split("@")[0],
      isBot: opts.isBot ?? false,
      createdAt: NOW,
    })
    .returning()
    .get();
}

// a group-stage match on `matchday`, kicking off in the future so picks are open
function makeMatch(matchday: number, kickoff: Date) {
  return db
    .insert(matches)
    .values({
      fdId: ++fd,
      stage: "GROUP_STAGE",
      matchday,
      kickoffUtc: kickoff,
      homeTeam: "A",
      awayTeam: "B",
      status: "TIMED",
      updatedAt: NOW,
    })
    .returning()
    .get();
}

function finish(matchId: number, regHome: number, regAway: number) {
  db.update(matches)
    .set({ status: "FINISHED", duration: "REGULAR", regHome, regAway })
    .where(eq(matches.id, matchId))
    .run();
}

function group(organizerId: string, rules: ScoringRules) {
  return createGroup(db, organizerId, { name: "Polla", scoringRules: rules }, NOW);
}

beforeEach(() => {
  db = createDb(":memory:");
  fd = 0;
});

describe("listRounds / getRound", () => {
  it("orders group matchdays then knockouts, flags started & complete", () => {
    const kickoff1 = new Date("2026-06-12T00:00:00Z");
    const kickoff2 = new Date("2030-06-12T00:00:00Z"); // far future
    const m1 = makeMatch(1, kickoff1);
    makeMatch(2, kickoff2);
    finish(m1.id, 1, 0);

    const now = new Date("2026-06-13T00:00:00Z");
    const rounds = listRounds(db.select().from(matches).all(), now);
    expect(rounds.map((r) => r.key)).toEqual(["GROUP_1", "GROUP_2"]);

    const r1 = getRound(db.select().from(matches).all(), "GROUP_1", now)!;
    expect(r1.started).toBe(true);
    expect(r1.complete).toBe(true);

    const r2 = getRound(db.select().from(matches).all(), "GROUP_2", now)!;
    expect(r2.started).toBe(false);
    expect(r2.complete).toBe(false);
  });

  it("recapTabAvailable: only once it's Jun 18 AND matchday 1 is over", () => {
    const a = makeMatch(1, new Date("2026-06-11T18:00:00Z"));
    const b = makeMatch(1, new Date("2026-06-18T01:00:00Z"));
    const all = () => db.select().from(matches).all();

    // MD1 not complete yet → hidden even well after Jun 18
    finish(a.id, 1, 0);
    expect(recapTabAvailable(all(), new Date("2026-06-19T00:00:00Z"))).toBe(false);

    // MD1 complete, but before the launch date → still hidden
    finish(b.id, 2, 2);
    expect(recapTabAvailable(all(), new Date("2026-06-17T23:00:00Z"))).toBe(false);

    // Jun 18 AND MD1 over → visible
    expect(recapTabAvailable(all(), new Date("2026-06-18T06:00:00Z"))).toBe(true);
  });

  it("featuredRecapRound surfaces a completed round only for ~2 days after it ends", () => {
    const k = new Date("2026-06-12T18:00:00Z");
    const m1 = makeMatch(1, k);
    finish(m1.id, 1, 0);
    const all = () => db.select().from(matches).all();
    // end ≈ kickoff + 2h = 20:00 UTC
    expect(featuredRecapRound(all(), new Date("2026-06-12T19:00:00Z"))).toBeNull(); // before end
    expect(featuredRecapRound(all(), new Date("2026-06-13T10:00:00Z"))?.key).toBe("GROUP_1"); // within window
    expect(featuredRecapRound(all(), new Date("2026-06-15T10:00:00Z"))).toBeNull(); // >2 days later
  });
});

describe("getRoundRecapForUser", () => {
  it("totals the round in the polla's own preset and ranks members", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const g = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g.id, NOW);

    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    const m2 = makeMatch(1, new Date("2030-01-02T00:00:00Z"));
    savePrediction(db, { userId: ana.id, groupId: g.id, matchId: m1.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: ana.id, groupId: g.id, matchId: m2.id, predHome: 1, predAway: 1 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: g.id, matchId: m1.id, predHome: 0, predAway: 0 }, NOW);
    finish(m1.id, 2, 1); // ana exact (3), beto wrong (0)
    finish(m2.id, 1, 1); // ana exact (3)

    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const ar = getRoundRecapForUser(db, ana.id, g.id, round);
    expect(ar.total).toBe(6);
    expect(ar.exactCount).toBe(2);
    expect(ar.rankInPolla).toBe(1);
    expect(ar.pollaSize).toBe(2);
    expect(ar.best?.match.id).toBe(m1.id);
    expect(ar.beatBot).toBeNull(); // no bot in this polla

    const br = getRoundRecapForUser(db, beto.id, g.id, round);
    expect(br.total).toBe(0);
    expect(br.rankInPolla).toBe(2);
  });

  it("nearMiss surfaces the closest non-exact pick, with solo-único drama + missed points", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const g = group(ana.id, { preset: "clasica", unicoAcertado: true });
    joinGroup(db, beto.id, g.id, NOW);

    const close = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    const far = makeMatch(1, new Date("2030-01-02T00:00:00Z"));
    savePrediction(db, { userId: ana.id, groupId: g.id, matchId: close.id, predHome: 2, predAway: 1 }, NOW); // actual 2-0 → 1 away, winner right
    savePrediction(db, { userId: ana.id, groupId: g.id, matchId: far.id, predHome: 0, predAway: 3 }, NOW); // actual 1-0 → 4 away
    savePrediction(db, { userId: beto.id, groupId: g.id, matchId: close.id, predHome: 0, predAway: 0 }, NOW); // nobody else exact
    finish(close.id, 2, 0);
    finish(far.id, 1, 0);

    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const r = getRoundRecapForUser(db, ana.id, g.id, round);
    expect(r.nearMiss?.match.id).toBe(close.id); // closest, not the 4-away one
    expect(r.nearMiss?.goalsAway).toBe(1);
    expect(r.nearMiss?.outcomeRight).toBe(true);
    expect(r.nearMiss?.soloExactMissed).toBe(true);
    expect(r.nearMiss?.missedPoints).toBe(8); // exact 3 + único 5
  });

  it("nearMiss drops the solo drama when someone else nailed the exact", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const g = group(ana.id, { preset: "clasica", unicoAcertado: true });
    joinGroup(db, beto.id, g.id, NOW);
    const m = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    savePrediction(db, { userId: ana.id, groupId: g.id, matchId: m.id, predHome: 2, predAway: 1 }, NOW); // 1 away
    savePrediction(db, { userId: beto.id, groupId: g.id, matchId: m.id, predHome: 2, predAway: 0 }, NOW); // exact
    finish(m.id, 2, 0);
    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const r = getRoundRecapForUser(db, ana.id, g.id, round);
    expect(r.nearMiss?.goalsAway).toBe(1);
    expect(r.nearMiss?.soloExactMissed).toBe(false);
    expect(r.nearMiss?.missedPoints).toBe(3); // exact only — beto already had it, no único
  });

  it("applies único and reports beating the bot", () => {
    const ana = makeUser("ana@b.co");
    const beto = makeUser("beto@b.co");
    const bot = makeUser("bot@b.co", { isBot: true, name: "Claudio" });
    const g = group(ana.id, { preset: "clasica", unicoAcertado: true });
    joinGroup(db, beto.id, g.id, NOW);
    joinGroup(db, bot.id, g.id, NOW);

    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    savePrediction(db, { userId: ana.id, groupId: g.id, matchId: m1.id, predHome: 2, predAway: 0 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: g.id, matchId: m1.id, predHome: 0, predAway: 0 }, NOW);
    savePrediction(db, { userId: bot.id, groupId: g.id, matchId: m1.id, predHome: 1, predAway: 1 }, NOW);
    finish(m1.id, 2, 0); // ana alone exact: 3 + 5 único = 8

    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const ar = getRoundRecapForUser(db, ana.id, g.id, round);
    expect(ar.total).toBe(8);
    expect(ar.beatBot).toBe(true);
    expect(ar.botPoints).toBe(0);
  });
});

describe("getGlobalRoundStanding", () => {
  function activePolla(rules: ScoringRules, picks: Array<[string, number, number]>) {
    // picks: [name, predHome, predAway] — first is organizer
    const members = picks.map(([name]) => makeUser(`${name}-${randomUUID()}@b.co`, { name }));
    const g = group(members[0].id, rules);
    for (const m of members.slice(1)) joinGroup(db, m.id, g.id, NOW);
    return { g, members };
  }

  it("re-scores everyone under clásica, keeps each person's best polla, ranks them", () => {
    // shared match across both pollas
    const m = makeMatch(1, new Date("2030-01-01T00:00:00Z"));

    // polla 1 (escalonada) — ana exact, beto miss
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const g1 = group(ana.id, { preset: "escalonada", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    savePrediction(db, { userId: ana.id, groupId: g1.id, matchId: m.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: g1.id, matchId: m.id, predHome: 0, predAway: 0 }, NOW);

    // polla 2 (marcador_o_nada) — carlos right winner, dina miss
    const carlos = makeUser("carlos@b.co", { name: "Carlos" });
    const dina = makeUser("dina@b.co", { name: "Dina" });
    const g2 = group(carlos.id, { preset: "marcador_o_nada", unicoAcertado: false });
    joinGroup(db, dina.id, g2.id, NOW);
    savePrediction(db, { userId: carlos.id, groupId: g2.id, matchId: m.id, predHome: 3, predAway: 0 }, NOW);
    savePrediction(db, { userId: dina.id, groupId: g2.id, matchId: m.id, predHome: 0, predAway: 2 }, NOW);

    finish(m.id, 2, 1);

    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const s = getGlobalRoundStanding(db, ana.id, round);

    // 4 humans across 2 active pollas. Clásica: ana 3 (exact), carlos 1 (winner), beto/dina 0
    expect(s.total).toBe(4);
    expect(s.eligible).toBe(true);
    expect(s.myRank).toBe(1);
    expect(s.top[0].isMe).toBe(true);
    expect(s.top[0].points).toBe(3);
    // ana sees her own name; carlos (other polla) is anonymized
    expect(s.top[0].displayName).toBe("Ana");
    const carlosEntry = s.top.find((e) => e.points === 1)!;
    expect(carlosEntry.displayName).toBeNull();
    expect(carlosEntry.alias).not.toBeNull();
  });

  it("includes the bot but excludes inactive (solo) pollas; bot doesn't count toward the ≥2 threshold", () => {
    const m = makeMatch(1, new Date("2030-01-01T00:00:00Z"));

    // active polla: ana + beto (2 humans) + bot. bot is scored & ranked.
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const bot = makeUser("bot@b.co", { isBot: true, name: "Claudio" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    joinGroup(db, bot.id, g1.id, NOW);
    savePrediction(db, { userId: ana.id, groupId: g1.id, matchId: m.id, predHome: 2, predAway: 1 }, NOW); // exact 3
    savePrediction(db, { userId: bot.id, groupId: g1.id, matchId: m.id, predHome: 1, predAway: 0 }, NOW); // winner+diff 2
    savePrediction(db, { userId: beto.id, groupId: g1.id, matchId: m.id, predHome: 3, predAway: 1 }, NOW); // winner only 1

    // bot-only polla: 1 human (zoe) + bot → not active (humans < 2), excluded
    const zoe = makeUser("zoe@b.co", { name: "Zoe" });
    const g2 = group(zoe.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, bot.id, g2.id, NOW);
    savePrediction(db, { userId: zoe.id, groupId: g2.id, matchId: m.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: bot.id, groupId: g2.id, matchId: m.id, predHome: 1, predAway: 0 }, NOW);

    finish(m.id, 2, 1);

    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const s = getGlobalRoundStanding(db, ana.id, round);
    // ana + beto + bot (g1 active); zoe excluded (solo polla)
    expect(s.total).toBe(3);
    const names = [...s.top, ...s.neighbors].map((e) => e.displayName);
    expect(names).toContain("Claudio"); // bot shown by name (it's in ana's polla)
    expect(names).not.toContain("Zoe");
    expect(s.topPercent).toBe(33); // ana rank 1 of 3
  });

  it("anonymizes consistently and never leaks an outsider's real name", () => {
    const m = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    savePrediction(db, { userId: ana.id, groupId: g1.id, matchId: m.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: beto.id, groupId: g1.id, matchId: m.id, predHome: 1, predAway: 1 }, NOW);

    const carlos = makeUser("carlos@b.co", { name: "Carlos" });
    const dina = makeUser("dina@b.co", { name: "Dina" });
    const g2 = group(carlos.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, dina.id, g2.id, NOW);
    savePrediction(db, { userId: carlos.id, groupId: g2.id, matchId: m.id, predHome: 2, predAway: 1 }, NOW);
    savePrediction(db, { userId: dina.id, groupId: g2.id, matchId: m.id, predHome: 0, predAway: 0 }, NOW);

    finish(m.id, 2, 1);

    const round = getRound(db.select().from(matches).all(), "GROUP_1")!;
    const s = getGlobalRoundStanding(db, ana.id, round);

    const outsiders = [...s.top, ...s.neighbors].filter(
      (e) => e.displayName === null,
    );
    // every anonymized entry gets a famous-player alias, no real name
    for (const e of outsiders) {
      expect(FAMOUS_ALIASES).toContain(e.alias);
    }
    // distinct players (by rank) get distinct aliases — top & neighbors can
    // legitimately overlap on the same player, so dedupe by rank first
    const aliasByRank = new Map<number, string | null>();
    for (const e of outsiders) aliasByRank.set(e.rank, e.alias);
    const aliases = [...aliasByRank.values()];
    expect(new Set(aliases).size).toBe(aliases.length);
    // carlos/dina must never appear by name to ana
    const names = [...s.top, ...s.neighbors].map((e) => e.displayName);
    expect(names).not.toContain("Carlos");
    expect(names).not.toContain("Dina");
    expect(names).toContain("Ana");
  });
});

describe("getPredictionBuddy", () => {
  function predict(userId: string, groupId: string, picks: Array<[number, number, number]>) {
    // picks: [matchId, home, away]
    for (const [matchId, h, a] of picks)
      savePrediction(db, { userId, groupId, matchId, predHome: h, predAway: a }, NOW);
  }

  it("picks the player who matches the most exact scorelines, across pollas", () => {
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const carlos = makeUser("carlos@b.co", { name: "Carlos" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    const g2 = group(carlos.id, { preset: "clasica", unicoAcertado: false }); // carlos: no overlap with ana

    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    const m2 = makeMatch(1, new Date("2030-01-02T00:00:00Z"));
    const m3 = makeMatch(1, new Date("2030-01-03T00:00:00Z"));

    predict(ana.id, g1.id, [[m1.id, 2, 1], [m2.id, 1, 1], [m3.id, 0, 0]]);
    predict(beto.id, g1.id, [[m1.id, 2, 1], [m2.id, 3, 0], [m3.id, 0, 0]]); // matches ana on m1, m3 → 2
    predict(carlos.id, g2.id, [[m1.id, 2, 1], [m2.id, 1, 1], [m3.id, 0, 0]]); // matches all 3 → 3

    const buddy = getPredictionBuddy(db, ana.id)!;
    expect(buddy.userId).toBe(carlos.id); // 3 beats beto's 2
    expect(buddy.shared).toBe(3);
    // carlos shares no polla with ana → anonymized as a famous alias
    expect(buddy.displayName).toBeNull();
    expect(FAMOUS_ALIASES).toContain(buddy.alias);
  });

  it("shows the buddy's real name when they share a polla", () => {
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    predict(ana.id, g1.id, [[m1.id, 2, 1]]);
    predict(beto.id, g1.id, [[m1.id, 2, 1]]);

    const buddy = getPredictionBuddy(db, ana.id)!;
    expect(buddy.userId).toBe(beto.id);
    expect(buddy.displayName).toBe("Beto");
    expect(buddy.alias).toBeNull();
  });

  it("never picks the bot, and returns null when nobody matches", () => {
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const bot = makeUser("bot@b.co", { isBot: true, name: "Claudio" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    joinGroup(db, bot.id, g1.id, NOW);
    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    predict(ana.id, g1.id, [[m1.id, 2, 1]]);
    predict(bot.id, g1.id, [[m1.id, 2, 1]]); // identical, but it's the bot
    predict(beto.id, g1.id, [[m1.id, 0, 3]]); // different

    expect(getPredictionBuddy(db, ana.id)).toBeNull(); // bot excluded, beto doesn't match
  });

  it("splits the polla buddy from the global buddy", () => {
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const carlos = makeUser("carlos@b.co", { name: "Carlos" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    const g2 = group(carlos.id, { preset: "clasica", unicoAcertado: false });

    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    const m2 = makeMatch(1, new Date("2030-01-02T00:00:00Z"));
    const m3 = makeMatch(1, new Date("2030-01-03T00:00:00Z"));

    predict(ana.id, g1.id, [[m1.id, 2, 1], [m2.id, 1, 1], [m3.id, 0, 0]]);
    predict(beto.id, g1.id, [[m1.id, 2, 1], [m2.id, 3, 0], [m3.id, 0, 0]]); // mate → 2 of 3
    predict(carlos.id, g2.id, [[m1.id, 2, 1], [m2.id, 1, 1], [m3.id, 0, 0]]); // outsider → 3 of 3

    const b = getPredictionBuddies(db, ana.id);
    expect(b.polla?.userId).toBe(beto.id); // closest within the polla
    expect(b.polla?.displayName).toBe("Beto");
    expect(b.polla?.shared).toBe(2);
    expect(b.polla?.total).toBe(3);
    expect(b.global?.userId).toBe(carlos.id); // closest overall (anonymized)
    expect(b.global?.displayName).toBeNull();
    expect(FAMOUS_ALIASES).toContain(b.global?.alias);
    expect(b.same).toBe(false);
  });

  it("collapses when the polla buddy is also the global buddy", () => {
    const ana = makeUser("ana@b.co", { name: "Ana" });
    const beto = makeUser("beto@b.co", { name: "Beto" });
    const carlos = makeUser("carlos@b.co", { name: "Carlos" });
    const g1 = group(ana.id, { preset: "clasica", unicoAcertado: false });
    joinGroup(db, beto.id, g1.id, NOW);
    const g2 = group(carlos.id, { preset: "clasica", unicoAcertado: false });

    const m1 = makeMatch(1, new Date("2030-01-01T00:00:00Z"));
    const m2 = makeMatch(1, new Date("2030-01-02T00:00:00Z"));

    predict(ana.id, g1.id, [[m1.id, 2, 1], [m2.id, 1, 1]]);
    predict(beto.id, g1.id, [[m1.id, 2, 1], [m2.id, 1, 1]]); // mate → 2 of 2
    predict(carlos.id, g2.id, [[m1.id, 2, 1], [m2.id, 0, 0]]); // outsider → 1 of 2

    const b = getPredictionBuddies(db, ana.id);
    expect(b.same).toBe(true);
    expect(b.polla?.userId).toBe(beto.id);
    expect(b.global?.userId).toBe(beto.id);
  });
});
