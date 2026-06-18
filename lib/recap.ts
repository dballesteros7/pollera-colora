import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { matches, memberships, predictions, users, groups } from "./db/schema";
import { PRESETS, parseScoringRules, type PresetDef } from "./scoring/presets";
import {
  scoreBreakdown,
  UNICO_BONUS,
  type MatchResult,
  type ScoreBreakdown,
} from "./scoring/score";
import { roundKey } from "./predictions";

type Match = typeof matches.$inferSelect;

// stage ordering for the round list (group stage splits into matchdays)
const STAGE_ORDER = [
  "GROUP_STAGE",
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

export interface Round {
  key: string; // roundKey: GROUP_1..GROUP_8, LAST_32..FINAL
  stage: string;
  matchday: number | null;
  matches: Match[];
  started: boolean; // at least one kickoff has passed
  complete: boolean; // every match finished with a regulation score
}

// regulation result present — the only matches that can be scored
function isFinished(m: Match): boolean {
  return (
    (m.status === "FINISHED" || m.status === "AWARDED") &&
    m.regHome !== null &&
    m.regAway !== null
  );
}

function resultOf(m: Match): MatchResult {
  return { regHome: m.regHome!, regAway: m.regAway!, stage: m.stage };
}

function roundOrder(r: Round): number {
  // group matchdays first (1..8), then knockout stages in bracket order
  return r.stage === "GROUP_STAGE"
    ? r.matchday ?? 0
    : 100 + STAGE_ORDER.indexOf(r.stage);
}

// Group every match into its round (joker scope), ordered for display.
export function listRounds(all: Match[], now = new Date()): Round[] {
  const byKey = new Map<string, Match[]>();
  for (const m of all) {
    const k = roundKey(m);
    byKey.set(k, [...(byKey.get(k) ?? []), m]);
  }
  const rounds: Round[] = [];
  for (const [key, ms] of byKey) {
    const sorted = ms
      .slice()
      .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());
    rounds.push({
      key,
      stage: sorted[0].stage,
      matchday: sorted[0].matchday,
      matches: sorted,
      started: sorted.some((m) => m.kickoffUtc.getTime() <= now.getTime()),
      complete: sorted.every(isFinished),
    });
  }
  return rounds.sort((a, b) => roundOrder(a) - roundOrder(b));
}

export function getRound(
  all: Match[],
  key: string,
  now = new Date(),
): Round | null {
  return listRounds(all, now).find((r) => r.key === key) ?? null;
}

// The round to feature prominently on the hub: the most recently completed one,
// for `windowDays` after its last match wrapped. Drives the "recap is ready!"
// banner so it's loud right after a matchday, then quietly steps back.
export function featuredRecapRound(
  all: Match[],
  now = new Date(),
  windowDays = 2,
): Round | null {
  const complete = listRounds(all, now).filter((r) => r.complete);
  const last = complete[complete.length - 1];
  if (!last) return null;
  // ~2h after the last kickoff the match is done; window runs from there
  const end =
    Math.max(...last.matches.map((m) => m.kickoffUtc.getTime())) + 2 * 3600_000;
  const within =
    now.getTime() >= end && now.getTime() <= end + windowDays * 24 * 3600_000;
  return within ? last : null;
}

// The "Resumen" tab joins the bottom bar on Jun 18, once matchday 1 is actually
// over — i.e. both the date has arrived AND every MD1 match has finished. (MD1's
// last match ends Jun 18, so completion is normally the binding condition; the
// date is a floor so a data quirk can't surface it early.)
export const RECAP_TAB_LAUNCH = new Date("2026-06-18T00:00:00Z");

export function recapTabAvailable(allMatches: Match[], now = new Date()): boolean {
  if (now.getTime() < RECAP_TAB_LAUNCH.getTime()) return false;
  const matchday1 = getRound(allMatches, "GROUP_1", now);
  return matchday1?.complete ?? false;
}

// ---- per-polla recap (uses the polla's OWN scoring system) ----

export interface RoundPick {
  match: Match;
  pred: { predHome: number; predAway: number; joker: boolean } | null;
  breakdown: ScoreBreakdown | null; // null until the match is finished
  unicoHit: boolean;
  points: number; // includes único, in the polla's preset
}

// "the one that got away": a non-exact pick, framed by how close it came to a
// perfect marcador — and how much that miss cost.
export interface NearMiss extends RoundPick {
  goalsAway: number; // |predHome−regHome| + |predAway−regAway| from the exact
  outcomeRight: boolean; // you still called the winner/draw
  soloExactMissed: boolean; // an exact here would've been único — nobody else got it
  missedPoints: number; // what nailing the exact would have paid (incl. joker/×/único)
}

export interface RoundRecap {
  round: Round;
  preset: PresetDef;
  picks: RoundPick[];
  total: number;
  exactCount: number;
  resultCount: number;
  best: RoundPick | null; // highest-scoring finished pick
  nearMiss: NearMiss | null; // the heartbreaker — closest you came to a perfect score
  rankInPolla: number; // 1-based, among all polla members (bot included)
  pollaSize: number;
  beatBot: boolean | null; // null when there's no bot pick to compare
  botPoints: number | null;
}

// Score one round for every member of a group, applying único per match.
function scoreRoundForGroup(
  db: Db,
  groupId: string,
  preset: PresetDef,
  unico: boolean,
  round: Round,
): Map<string, { points: number; exact: number; result: number }> {
  const finished = round.matches.filter(isFinished);
  const matchIds = finished.map((m) => m.id);

  const members = db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.groupId, groupId))
    .all();

  const totals = new Map<
    string,
    { points: number; exact: number; result: number }
  >();
  for (const m of members) totals.set(m.userId, { points: 0, exact: 0, result: 0 });

  if (matchIds.length === 0) return totals;

  const preds = db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.groupId, groupId),
        inArray(predictions.matchId, matchIds),
      ),
    )
    .all();
  const byMatch = new Map<number, typeof preds>();
  for (const p of preds) {
    byMatch.set(p.matchId, [...(byMatch.get(p.matchId) ?? []), p]);
  }

  for (const match of finished) {
    const result = resultOf(match);
    const scored = (byMatch.get(match.id) ?? [])
      .filter((p) => totals.has(p.userId))
      .map((p) => ({ p, b: scoreBreakdown(p, result, preset) }));
    const exactCount = scored.filter(({ b }) => b.exact).length;
    for (const { p, b } of scored) {
      const t = totals.get(p.userId)!;
      let pts = b.points;
      if (unico && b.exact && exactCount === 1) pts += UNICO_BONUS;
      t.points += pts;
      if (b.exact) t.exact++;
      if (b.result) t.result++;
    }
  }
  return totals;
}

export function getRoundRecapForUser(
  db: Db,
  userId: string,
  groupId: string,
  round: Round,
): RoundRecap {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get()!;
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];

  const totals = scoreRoundForGroup(db, groupId, preset, rules.unicoAcertado, round);

  // viewer's picks across every match in the round (finished or not)
  const myPreds = db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.groupId, groupId),
        eq(predictions.userId, userId),
        inArray(
          predictions.matchId,
          round.matches.map((m) => m.id),
        ),
      ),
    )
    .all();
  const myByMatch = new Map(myPreds.map((p) => [p.matchId, p]));

  // único needs the count of exact picks per finished match across the polla
  const exactByMatch = new Map<number, number>();
  for (const match of round.matches.filter(isFinished)) {
    const all = db
      .select()
      .from(predictions)
      .where(
        and(eq(predictions.groupId, groupId), eq(predictions.matchId, match.id)),
      )
      .all();
    const result = resultOf(match);
    exactByMatch.set(
      match.id,
      all.filter((p) => scoreBreakdown(p, result, preset).exact).length,
    );
  }

  const picks: RoundPick[] = round.matches.map((match) => {
    const pred = myByMatch.get(match.id) ?? null;
    if (!pred || !isFinished(match)) {
      return { match, pred, breakdown: null, unicoHit: false, points: 0 };
    }
    const b = scoreBreakdown(pred, resultOf(match), preset);
    const unicoHit =
      rules.unicoAcertado && b.exact && (exactByMatch.get(match.id) ?? 0) === 1;
    return {
      match,
      pred,
      breakdown: b,
      unicoHit,
      points: b.points + (unicoHit ? UNICO_BONUS : 0),
    };
  });

  const finishedPicks = picks.filter((p) => p.breakdown !== null);
  const best =
    finishedPicks.length > 0
      ? finishedPicks.reduce((a, b) => (b.points > a.points ? b : a))
      : null;

  // the heartbreaker: among the marcadores you *didn't* nail, the one you came
  // closest on. Ties break toward "you still got the winner" and toward an
  // exact that would've been solo único — the most agonizing kind of miss.
  const nearMiss: NearMiss | null =
    finishedPicks
      .filter((p) => p.breakdown && !p.breakdown.exact)
      .map((p) => {
        const goalsAway =
          Math.abs(p.pred!.predHome - p.match.regHome!) +
          Math.abs(p.pred!.predAway - p.match.regAway!);
        const soloExactMissed =
          rules.unicoAcertado && (exactByMatch.get(p.match.id) ?? 0) === 0;
        // what nailing the exact would have paid — keeping this pick's joker,
        // plus the único bonus you'd have earned for being alone
        const exactBreak = scoreBreakdown(
          { predHome: p.match.regHome!, predAway: p.match.regAway!, joker: p.pred!.joker },
          resultOf(p.match),
          preset,
        );
        return {
          ...p,
          goalsAway,
          outcomeRight: p.breakdown!.result,
          soloExactMissed,
          missedPoints: exactBreak.points + (soloExactMissed ? UNICO_BONUS : 0),
        };
      })
      .sort(
        (a, b) =>
          a.goalsAway - b.goalsAway ||
          Number(b.outcomeRight) - Number(a.outcomeRight) ||
          Number(b.soloExactMissed) - Number(a.soloExactMissed) ||
          b.missedPoints - a.missedPoints,
      )[0] ?? null;

  // rank within the polla for this round
  const ranked = [...totals.entries()]
    .map(([uid, t]) => ({ userId: uid, ...t }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exact - a.exact ||
        b.result - a.result ||
        a.userId.localeCompare(b.userId),
    );
  const rankInPolla = ranked.findIndex((r) => r.userId === userId) + 1;

  // bot comparison
  const bot = db
    .select({ id: users.id })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(and(eq(memberships.groupId, groupId), eq(users.isBot, true)))
    .get();
  const botPoints = bot ? (totals.get(bot.id)?.points ?? null) : null;
  const myPoints = totals.get(userId)?.points ?? 0;
  const beatBot = botPoints === null ? null : myPoints > botPoints;

  const me = totals.get(userId);
  return {
    round,
    preset,
    picks,
    total: me?.points ?? 0,
    exactCount: me?.exact ?? 0,
    resultCount: me?.result ?? 0,
    best,
    nearMiss,
    rankInPolla,
    pollaSize: ranked.length,
    beatBot,
    botPoints,
  };
}

// ---- cross-polla glimpse (everyone re-scored under clásica, anonymized) ----

export interface GlobalEntry {
  rank: number;
  isMe: boolean;
  isBot: boolean; // Claudio — gets the bot icon
  points: number;
  displayName: string | null; // set only when the viewer may see the real name
  alias: string | null; // set only when anonymized
}

export interface GlobalStanding {
  eligible: boolean; // viewer participates in an active polla this round
  total: number; // players in the pool
  myRank: number | null;
  topPercent: number | null; // "top X%"
  top: GlobalEntry[]; // top 3
  neighbors: GlobalEntry[]; // viewer ±2 (empty when not eligible)
}

// Famous footballers, with a wink. Used to mask players from pollas the viewer
// isn't in: recognizable but clearly a gag, so nobody mistakes it for a leak of
// a real name. Kept to household names only — with a small group, a short list
// of universally known players is enough and reads more clearly as a joke.
export const FAMOUS_ALIASES = [
  "Lionel Messías",
  "Cristiano Ronaldoh",
  "Diego Maradoh",
  "Zinedine Zidance",
  "Ronaldinha Gaúcho",
  "Kylian Mbappémonos",
  "Andrés Iniestá",
  "David Beckhambre",
  "Johan Cruyffío",
  "Robert Lewandifícil",
  "Sergio Ramirámos",
  "Gianluigi Bufón",
  "Manuel Neuerón",
  "Luka Modríguez",
] as const;

// deterministic (no Math.random) — FNV-1a, so a viewer always sees the same
// alias for the same player across renders.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getGlobalRoundStanding(
  db: Db,
  viewerId: string,
  round: Round,
): GlobalStanding {
  const empty: GlobalStanding = {
    eligible: false,
    total: 0,
    myRank: null,
    topPercent: null,
    top: [],
    neighbors: [],
  };

  const finished = round.matches.filter(isFinished);
  if (finished.length === 0) return empty;
  const resultByMatch = new Map(finished.map((m) => [m.id, resultOf(m)]));
  const ids = finished.map((m) => m.id);

  // every prediction for the round's finished matches, across all pollas
  const preds = db
    .select({
      userId: predictions.userId,
      groupId: predictions.groupId,
      matchId: predictions.matchId,
      predHome: predictions.predHome,
      predAway: predictions.predAway,
      joker: predictions.joker,
    })
    .from(predictions)
    .where(inArray(predictions.matchId, ids))
    .all();

  // who's a bot, and display names
  const userRows = db
    .select({ id: users.id, isBot: users.isBot, displayName: users.displayName })
    .from(users)
    .all();
  const isBot = new Map(userRows.map((u) => [u.id, u.isBot]));
  const nameById = new Map(userRows.map((u) => [u.id, u.displayName]));

  // active polla (for this round) = ≥2 distinct humans who predicted in it
  const groupHumans = new Map<string, Set<string>>();
  for (const p of preds) {
    if (isBot.get(p.userId)) continue;
    if (!groupHumans.has(p.groupId)) groupHumans.set(p.groupId, new Set());
    groupHumans.get(p.groupId)!.add(p.userId);
  }
  const activeGroups = new Set(
    [...groupHumans].filter(([, s]) => s.size >= 2).map(([g]) => g),
  );
  if (activeGroups.size === 0) return empty;

  // clásica points per (person, polla), then keep each person's best polla.
  // the bot is scored too (it appears once — it bets the same everywhere, so
  // its best polla equals every polla); only the active-polla *threshold* above
  // is humans-only.
  const perPG = new Map<string, { userId: string; points: number; exact: number }>();
  for (const p of preds) {
    if (!activeGroups.has(p.groupId)) continue;
    const res = resultByMatch.get(p.matchId)!;
    const b = scoreBreakdown(p, res, PRESETS.clasica);
    const k = `${p.userId}::${p.groupId}`;
    const cur = perPG.get(k) ?? { userId: p.userId, points: 0, exact: 0 };
    cur.points += b.points;
    if (b.exact) cur.exact++;
    perPG.set(k, cur);
  }
  const best = new Map<string, { points: number; exact: number }>();
  for (const v of perPG.values()) {
    const cur = best.get(v.userId);
    if (!cur || v.points > cur.points || (v.points === cur.points && v.exact > cur.exact)) {
      best.set(v.userId, { points: v.points, exact: v.exact });
    }
  }
  if (best.size === 0) return empty;

  const ranked = [...best.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exact - a.exact ||
        a.userId.localeCompare(b.userId),
    );
  const total = ranked.length;

  // people who share any polla with the viewer keep their real name
  const myGroupRows = db
    .select({ groupId: memberships.groupId })
    .from(memberships)
    .where(eq(memberships.userId, viewerId))
    .all();
  const myGroupIds = myGroupRows.map((r) => r.groupId);
  const mates = new Set<string>([viewerId]);
  if (myGroupIds.length > 0) {
    for (const r of db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(inArray(memberships.groupId, myGroupIds))
      .all()) {
      mates.add(r.userId);
    }
  }

  // assign each outsider a famous alias, walking ranked order and probing for
  // the next free name so no two outsiders share one within this board
  const aliasByUser = new Map<string, string>();
  const usedAliases = new Set<string>();
  for (const r of ranked) {
    if (mates.has(r.userId)) continue;
    const start = hashStr(`${viewerId}|${r.userId}`) % FAMOUS_ALIASES.length;
    let name = "";
    for (let k = 0; k < FAMOUS_ALIASES.length; k++) {
      const cand = FAMOUS_ALIASES[(start + k) % FAMOUS_ALIASES.length];
      if (!usedAliases.has(cand)) {
        name = cand;
        break;
      }
    }
    // more outsiders than names (huge pool) — fall back to a numbered suffix
    if (!name) name = `${FAMOUS_ALIASES[start]} ${usedAliases.size}`;
    usedAliases.add(name);
    aliasByUser.set(r.userId, name);
  }

  const toEntry = (
    r: { userId: string; points: number },
    rank: number,
  ): GlobalEntry => {
    const isMe = r.userId === viewerId;
    const known = mates.has(r.userId);
    return {
      rank,
      isMe,
      isBot: isBot.get(r.userId) ?? false,
      points: r.points,
      displayName: known ? (nameById.get(r.userId) ?? null) : null,
      alias: known ? null : (aliasByUser.get(r.userId) ?? null),
    };
  };

  const top = ranked.slice(0, 3).map((r, i) => toEntry(r, i + 1));

  const myIdx = ranked.findIndex((r) => r.userId === viewerId);
  if (myIdx < 0) {
    return { ...empty, total, top };
  }

  const from = Math.max(0, myIdx - 2);
  const to = Math.min(total - 1, myIdx + 2);
  const neighbors: GlobalEntry[] = [];
  for (let i = from; i <= to; i++) neighbors.push(toEntry(ranked[i], i + 1));

  return {
    eligible: true,
    total,
    myRank: myIdx + 1,
    topPercent: Math.max(1, Math.round(((myIdx + 1) / total) * 100)),
    top,
    neighbors,
  };
}

// ---- "your buddy": the player who predicts most like you ----

// single famous alias for one player (the board's de-dup uses this as its
// starting pick, so a person reads the same in both places almost always).
export function famousAlias(viewerId: string, targetId: string): string {
  return FAMOUS_ALIASES[hashStr(`${viewerId}|${targetId}`) % FAMOUS_ALIASES.length];
}

export interface Buddy {
  userId: string;
  displayName: string | null; // when they share a polla with the viewer
  alias: string | null; // famous alias otherwise — same privacy rule as the board
  shared: number; // matches where you both called the exact same scoreline
  total: number; // matches you both predicted (the comparable set) — shared ≤ total
  scope: "polla" | "global"; // restricted to your pollas, or across everyone
}

export interface Buddies {
  polla: Buddy | null; // closest match among players who share a polla with you
  global: Buddy | null; // closest match across everyone
  same: boolean; // the two are the same person → render a single combined card
}

// Your prediction soulmate(s): the (human) players whose exact scorelines match
// yours on the most matches. Returns two — your closest within your own pollas,
// and your closest across everyone — flagged `same` when they coincide. All-time,
// not per-round.
export function getPredictionBuddies(db: Db, viewerId: string): Buddies {
  const none: Buddies = { polla: null, global: null, same: false };

  const mine = db
    .select({
      matchId: predictions.matchId,
      predHome: predictions.predHome,
      predAway: predictions.predAway,
    })
    .from(predictions)
    .where(eq(predictions.userId, viewerId))
    .all();
  if (mine.length === 0) return none;

  // every scoreline the viewer predicted per match (may differ across pollas)
  const mineByMatch = new Map<number, Set<string>>();
  for (const p of mine) {
    const set = mineByMatch.get(p.matchId) ?? new Set<string>();
    set.add(`${p.predHome}-${p.predAway}`);
    mineByMatch.set(p.matchId, set);
  }
  const matchIds = [...mineByMatch.keys()];

  const others = db
    .select({
      userId: predictions.userId,
      matchId: predictions.matchId,
      predHome: predictions.predHome,
      predAway: predictions.predAway,
    })
    .from(predictions)
    .where(inArray(predictions.matchId, matchIds))
    .all();

  const userRows = db
    .select({ id: users.id, isBot: users.isBot, displayName: users.displayName })
    .from(users)
    .all();
  const isBot = new Map(userRows.map((u) => [u.id, u.isBot]));
  const nameById = new Map(userRows.map((u) => [u.id, u.displayName]));

  // per other player: distinct matches you both predicted (the comparable set),
  // and the subset where a scoreline agrees with one of mine
  const agree = new Map<string, Set<number>>();
  const both = new Map<string, Set<number>>();
  for (const p of others) {
    if (p.userId === viewerId || isBot.get(p.userId)) continue;
    const bs = both.get(p.userId) ?? new Set<number>();
    bs.add(p.matchId);
    both.set(p.userId, bs);
    if (mineByMatch.get(p.matchId)?.has(`${p.predHome}-${p.predAway}`)) {
      const s = agree.get(p.userId) ?? new Set<number>();
      s.add(p.matchId);
      agree.set(p.userId, s);
    }
  }
  if (agree.size === 0) return none;

  // who shares a polla with the viewer — keeps their real name, and defines the
  // "within polla" candidate pool
  const myGroupIds = db
    .select({ groupId: memberships.groupId })
    .from(memberships)
    .where(eq(memberships.userId, viewerId))
    .all()
    .map((r) => r.groupId);
  const mates = new Set<string>();
  if (myGroupIds.length > 0) {
    for (const r of db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(inArray(memberships.groupId, myGroupIds))
      .all()) {
      mates.add(r.userId);
    }
  }

  // best agreement among a candidate set (most shared scorelines wins)
  const winnerAmong = (allow: (uid: string) => boolean) =>
    [...agree.entries()]
      .filter(([uid]) => allow(uid))
      .map(([uid, set]) => ({
        userId: uid,
        shared: set.size,
        total: both.get(uid)?.size ?? set.size,
      }))
      .sort((a, b) => b.shared - a.shared || a.userId.localeCompare(b.userId))[0] ?? null;

  const toBuddy = (
    w: { userId: string; shared: number; total: number } | null,
    scope: "polla" | "global",
  ): Buddy | null => {
    if (!w) return null;
    const known = mates.has(w.userId);
    return {
      userId: w.userId,
      displayName: known ? (nameById.get(w.userId) ?? null) : null,
      alias: known ? null : famousAlias(viewerId, w.userId),
      shared: w.shared,
      total: w.total,
      scope,
    };
  };

  const polla = toBuddy(winnerAmong((uid) => mates.has(uid)), "polla");
  const global = toBuddy(winnerAmong(() => true), "global");
  const same = !!polla && !!global && polla.userId === global.userId;
  return { polla, global, same };
}

// Back-compat: the single, cross-polla buddy.
export function getPredictionBuddy(db: Db, viewerId: string): Buddy | null {
  return getPredictionBuddies(db, viewerId).global;
}
