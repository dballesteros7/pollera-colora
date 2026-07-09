import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import {
  bonusPicks,
  groups,
  matches,
  memberships,
  predictions,
  superIdentities,
  users,
} from "./db/schema";
import { roundKey } from "./predictions";
import type { ScoringRules } from "./scoring/presets";
import { getLeaderboard } from "./leaderboard";
import { assignAliases } from "./anon";

// the Superpolla ruleset (Marcador o nada + comodín) lives in the leaf presets
// module; re-exported here so existing importers don't move
export { SUPER_PRESET } from "./scoring/presets";

// The Superpolla is a singleton group flagged `isSuper`. Every active player
// (anyone in at least one regular polla) is auto-enrolled. Players make their
// knockout picks (and comodín) in the Superpolla itself; any match they
// haven't picked here falls back to their regular pollas — earliest joined
// first — so nobody misses points just because they never opened this page.
export const SUPER_POLLA_NAME = "La Superpolla";

const SUPER_RULES: ScoringRules = {
  preset: "marcador_o_nada",
  unicoAcertado: false,
};

// the Superpolla only counts knockout matches — the group stage stays in each
// player's own polla. Every non-group stage is a knockout round.
export function isKnockoutStage(stage: string): boolean {
  return stage !== "GROUP_STAGE";
}

export function getSuperPolla(db: Db) {
  return db.select().from(groups).where(eq(groups.isSuper, true)).get() ?? null;
}

// the organizer FK just needs a real user; the Superpolla exposes no organizer
// powers. Prefer the first admin, fall back to the earliest human player.
function pickOrganizer(db: Db): string | null {
  const admin = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .orderBy(asc(users.createdAt))
    .get();
  if (admin) return admin.id;
  const human = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isBot, false))
    .orderBy(asc(users.createdAt))
    .get();
  return human?.id ?? null;
}

// invite code is never advertised (joining is automatic) but the column is
// unique + NOT NULL, so give it a real random value.
function randomCode(): string {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(10), (b) => A[b % A.length]).join("");
}

// idempotent: creates the singleton on first call once at least one user
// exists. Returns null when the DB has no users yet (created lazily later).
export function ensureSuperPolla(db: Db, now = new Date()) {
  const existing = getSuperPolla(db);
  if (existing) return existing;
  const organizerId = pickOrganizer(db);
  if (!organizerId) return null;
  return db
    .insert(groups)
    .values({
      id: randomUUID(),
      name: SUPER_POLLA_NAME,
      inviteCode: randomCode(),
      organizerId,
      scoringRules: SUPER_RULES,
      isSuper: true,
      potNote: null,
      createdAt: now,
    })
    .returning()
    .get();
}

// auto-enroll: every player in a regular polla becomes a Superpolla member.
// Safe to call repeatedly (on join, on group create, on score rebuild).
export function syncSuperPollaMembership(db: Db, now = new Date()) {
  const sp = ensureSuperPolla(db, now);
  if (!sp) return null;

  const activeUserIds = db
    .selectDistinct({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(eq(groups.isSuper, false))
    .all()
    .map((r) => r.userId);

  const already = new Set(
    db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.groupId, sp.id))
      .all()
      .map((r) => r.userId),
  );

  for (const userId of activeUserIds) {
    if (already.has(userId)) continue;
    db.insert(memberships)
      .values({ userId, groupId: sp.id, role: "member", joinedAt: now })
      .onConflictDoNothing()
      .run();
  }
  return sp;
}

// every member's fallback order: their regular pollas, earliest joined first.
// The first entry is the "home" polla, but later ones count too — a player's
// bets live wherever they actually play, not only in the polla they joined first.
function pollaOrderByUser(db: Db): Map<string, string[]> {
  const order = new Map<string, string[]>();
  for (const r of db
    .select({ userId: memberships.userId, groupId: memberships.groupId })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(eq(groups.isSuper, false))
    .orderBy(asc(memberships.joinedAt))
    .all()) {
    const list = order.get(r.userId);
    if (list) list.push(r.groupId);
    else order.set(r.userId, [r.groupId]);
  }
  return order;
}

// a player's regular pollas in fallback order (earliest joined first)
export function regularPollaIdsOf(db: Db, userId: string): string[] {
  return db
    .select({ groupId: memberships.groupId })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(and(eq(memberships.userId, userId), eq(groups.isSuper, false)))
    .orderBy(asc(memberships.joinedAt))
    .all()
    .map((r) => r.groupId);
}

// Everyone's *effective* pick per match — a player's own Superpolla pick,
// falling back to the earliest of their regular pollas that has one. Inherited
// picks never bring their comodín along: the Superpolla joker is chosen in
// the Superpolla itself (see SUPER_PRESET), a home-polla joker keeps doubling
// only at home. But nobody plays a round bare either: a player who never set a
// comodín here gets it auto-applied to the last match of the round they have a
// pick for. This is the single merge the score rebuild, the reveal UI and the
// pick pre-fill use, so the picks shown always match the points awarded.
export interface SuperEffectivePick {
  userId: string;
  matchId: number;
  predHome: number;
  predAway: number;
  joker: boolean;
  fromHome: boolean; // inherited from a regular polla, not set in the Superpolla
  autoJoker: boolean; // joker granted by the auto-comodín, not placed by hand
}

export function effectiveSuperPicksByUser(
  db: Db,
  matchIds: number[],
): Map<string, Map<number, SuperEffectivePick>> {
  const out = new Map<string, Map<number, SuperEffectivePick>>();
  if (matchIds.length === 0) return out;
  const sp = getSuperPolla(db);
  if (!sp) return out;

  const memberIds = new Set(
    db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.groupId, sp.id))
      .all()
      .map((r) => r.userId),
  );
  if (memberIds.size === 0) return out;

  const order = pollaOrderByUser(db);

  // the merge always runs over every knockout match — the auto-comodín needs
  // whole-round context — and is filtered to the requested matches at the end
  const knockout = db
    .select()
    .from(matches)
    .all()
    .filter((m) => isKnockoutStage(m.stage));
  const knockoutIds = knockout.map((m) => m.id);
  if (knockoutIds.length === 0) return out;

  const own = db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.groupId, sp.id),
        inArray(predictions.matchId, knockoutIds),
      ),
    )
    .all();
  const regularGroupIds = [...new Set([...order.values()].flat())];
  const regular =
    regularGroupIds.length > 0
      ? db
          .select()
          .from(predictions)
          .where(
            and(
              inArray(predictions.groupId, regularGroupIds),
              inArray(predictions.matchId, knockoutIds),
            ),
          )
          .all()
      : [];

  const put = (p: (typeof own)[number], fromHome: boolean) => {
    let byMatch = out.get(p.userId);
    if (!byMatch) out.set(p.userId, (byMatch = new Map()));
    byMatch.set(p.matchId, {
      userId: p.userId,
      matchId: p.matchId,
      predHome: p.predHome,
      predAway: p.predAway,
      joker: fromHome ? false : p.joker,
      fromHome,
      autoJoker: false,
    });
  };

  const ownKeys = new Set(own.map((p) => `${p.userId}|${p.matchId}`));
  for (const p of own) {
    if (memberIds.has(p.userId)) put(p, false);
  }
  // gaps fill from the earliest-joined polla that has a pick for that match
  const bestRank = new Map<string, number>();
  for (const p of regular) {
    if (!memberIds.has(p.userId)) continue;
    if (ownKeys.has(`${p.userId}|${p.matchId}`)) continue; // own pick wins
    const rank = order.get(p.userId)?.indexOf(p.groupId) ?? -1;
    if (rank < 0) continue;
    const key = `${p.userId}|${p.matchId}`;
    const prev = bestRank.get(key);
    if (prev !== undefined && prev <= rank) continue;
    bestRank.set(key, rank);
    put(p, true);
  }

  // auto-comodín: everyone plays a joker every knockout round. If a player
  // never switched one on here, it lands on the last match of the round they
  // have a pick for (latest kickoff, then highest id for safety — knockout
  // games never kick off together).
  const matchById = new Map(knockout.map((m) => [m.id, m]));
  for (const byMatch of out.values()) {
    const ownJokerRounds = new Set<string>();
    for (const p of byMatch.values()) {
      if (p.joker) ownJokerRounds.add(roundKey(matchById.get(p.matchId)!));
    }
    const lastByRound = new Map<string, SuperEffectivePick>();
    for (const p of byMatch.values()) {
      const m = matchById.get(p.matchId)!;
      const round = roundKey(m);
      if (ownJokerRounds.has(round)) continue;
      const cur = lastByRound.get(round);
      const curM = cur ? matchById.get(cur.matchId)! : null;
      if (
        !curM ||
        m.kickoffUtc.getTime() > curM.kickoffUtc.getTime() ||
        (m.kickoffUtc.getTime() === curM.kickoffUtc.getTime() && m.id > curM.id)
      ) {
        lastByRound.set(round, p);
      }
    }
    for (const p of lastByRound.values()) {
      p.joker = true;
      p.autoJoker = true;
    }
  }

  // filter down to what the caller asked about
  const wanted = new Set(matchIds);
  const filtered = new Map<string, Map<number, SuperEffectivePick>>();
  for (const [userId, byMatch] of out) {
    const kept = new Map(
      [...byMatch].filter(([matchId]) => wanted.has(matchId)),
    );
    if (kept.size > 0) filtered.set(userId, kept);
  }
  return filtered;
}

// the same merge, shaped per match for the reveal UI. Only call this for
// locked matches: picks are secret until kickoff.
export function getSuperEffectivePicks(
  db: Db,
  matchIds: number[],
): Map<number, SuperEffectivePick[]> {
  const out = new Map<number, SuperEffectivePick[]>();
  for (const byMatch of effectiveSuperPicksByUser(db, matchIds).values()) {
    for (const p of byMatch.values()) {
      out.set(p.matchId, [...(out.get(p.matchId) ?? []), p]);
    }
  }
  return out;
}

// Everyone's effective tournament bonus picks (champion, top scorer, …): the
// player's own Superpolla pick per category, falling back to the earliest of
// their regular pollas that has that category set.
export interface SuperEffectiveBonus {
  value: string;
  fromHome: boolean;
}

export function effectiveSuperBonusByUser(
  db: Db,
): Map<string, Map<string, SuperEffectiveBonus>> {
  const out = new Map<string, Map<string, SuperEffectiveBonus>>();
  const sp = getSuperPolla(db);
  if (!sp) return out;
  const memberIds = new Set(
    db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.groupId, sp.id))
      .all()
      .map((r) => r.userId),
  );
  const order = pollaOrderByUser(db);

  const bestRank = new Map<string, number>();
  for (const b of db.select().from(bonusPicks).all()) {
    if (!memberIds.has(b.userId)) continue;
    let rank: number;
    if (b.groupId === sp.id) {
      rank = -1; // the player's own Superpolla pick always wins
    } else {
      const i = order.get(b.userId)?.indexOf(b.groupId) ?? -1;
      if (i < 0) continue; // not one of their regular pollas
      rank = i;
    }
    const key = `${b.userId}|${b.category}`;
    const prev = bestRank.get(key);
    if (prev !== undefined && prev <= rank) continue;
    bestRank.set(key, rank);
    let byCat = out.get(b.userId);
    if (!byCat) out.set(b.userId, (byCat = new Map()));
    byCat.set(b.category, { value: b.value, fromHome: rank >= 0 });
  }
  return out;
}

// ---- per-player identity (chosen on first open) ----

export type SuperIdentityMode = "real" | "nickname";

export function getSuperIdentity(db: Db, userId: string) {
  return (
    db
      .select()
      .from(superIdentities)
      .where(eq(superIdentities.userId, userId))
      .get() ?? null
  );
}

// "real" reveals the display name to everyone; "nickname" shows the handle. The
// row's mere existence marks the first-open choice as made.
export function setSuperIdentity(
  db: Db,
  userId: string,
  mode: SuperIdentityMode,
  nickname: string | null,
  now = new Date(),
) {
  const nick = mode === "nickname" ? (nickname?.trim() || null) : null;
  db.insert(superIdentities)
    .values({ userId, mode, nickname: nick, updatedAt: now })
    .onConflictDoUpdate({
      target: superIdentities.userId,
      set: { mode, nickname: nick, updatedAt: now },
    })
    .run();
}

export interface SuperRow {
  userId: string;
  rank: number;
  isYou: boolean;
  isBot: boolean;
  name: string; // the label to display to this viewer
  masked: boolean; // true → a famous-footballer alias (style it as a gag)
  total: number;
  exactCount: number;
}

const NO_NAME = "(sin nombre)";

// The Superpolla leaderboard as a given viewer should see it: each player's
// chosen identity wins (real name or nickname); otherwise pollamates and the bot
// keep their real names and everyone else is masked with a famous-footballer
// alias — the same cross-polla anonymization used in the recaps.
export function superLeaderboard(db: Db, viewerId: string): SuperRow[] {
  const sp = getSuperPolla(db);
  if (!sp) return [];
  const board = getLeaderboard(db, sp.id); // already ranked

  // everyone who shares a *real* polla with the viewer keeps their real name
  const myGroupIds = db
    .select({ groupId: memberships.groupId })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(and(eq(memberships.userId, viewerId), eq(groups.isSuper, false)))
    .all()
    .map((r) => r.groupId);
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

  const identityById = new Map(
    db.select().from(superIdentities).all().map((i) => [i.userId, i]),
  );

  // a player is masked only if they haven't chosen an identity, aren't a
  // pollamate, and aren't the bot
  const maskedIds = new Set(
    board
      .filter(
        (r) =>
          !identityById.has(r.userId) && !mates.has(r.userId) && !r.isBot,
      )
      .map((r) => r.userId),
  );
  const aliases = assignAliases(
    viewerId,
    board.map((r) => r.userId),
    (uid) => maskedIds.has(uid),
  );

  return board.map((r, i) => {
    const id = identityById.get(r.userId);
    let name: string;
    let masked = false;
    if (id?.mode === "nickname" && id.nickname) {
      name = id.nickname;
    } else if (id?.mode === "real") {
      name = r.displayName ?? NO_NAME;
    } else if (mates.has(r.userId) || r.isBot) {
      // includes the viewer themselves (in `mates`) before they've decided
      name = r.displayName ?? NO_NAME;
    } else {
      name = aliases.get(r.userId) ?? NO_NAME;
      masked = true;
    }
    return {
      userId: r.userId,
      rank: i + 1,
      isYou: r.userId === viewerId,
      isBot: r.isBot,
      name,
      masked,
      total: r.total,
      exactCount: r.exactCount,
    };
  });
}
