import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { groups, memberships, superIdentities, users } from "./db/schema";
import type { ScoringRules } from "./scoring/presets";
import { getLeaderboard } from "./leaderboard";
import { assignAliases } from "./anon";

// the Súper Polla ruleset (Marcador o nada + comodín) lives in the leaf presets
// module; re-exported here so existing importers don't move
export { SUPER_PRESET } from "./scoring/presets";

// The Súper Polla is a singleton group flagged `isSuper`. Every active player
// (anyone in at least one regular polla) is auto-enrolled and scored by reusing
// the knockout-stage picks from their *home polla* — the regular polla they
// joined first. It has no pick entry of its own: your real picks compete here.
export const SUPER_POLLA_NAME = "La Súper Polla";

const SUPER_RULES: ScoringRules = {
  preset: "marcador_o_nada",
  unicoAcertado: false,
};

// the Súper Polla only counts knockout matches — the group stage stays in each
// player's own polla. Every non-group stage is a knockout round.
export function isKnockoutStage(stage: string): boolean {
  return stage !== "GROUP_STAGE";
}

export function getSuperPolla(db: Db) {
  return db.select().from(groups).where(eq(groups.isSuper, true)).get() ?? null;
}

// the organizer FK just needs a real user; the Súper Polla exposes no organizer
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

// auto-enroll: every player in a regular polla becomes a Súper Polla member.
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

// a player's home polla: the regular polla they joined first. Its picks are the
// ones that count globally for players who belong to more than one polla.
export function homePollaIdOf(db: Db, userId: string): string | null {
  const row = db
    .select({ groupId: memberships.groupId })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(and(eq(memberships.userId, userId), eq(groups.isSuper, false)))
    .orderBy(asc(memberships.joinedAt))
    .get();
  return row?.groupId ?? null;
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

// The Súper Polla leaderboard as a given viewer should see it: each player's
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
