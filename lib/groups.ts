import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { groups, memberships, users } from "./db/schema";
import type { ScoringRules } from "./scoring/presets";
import { addClaudeToGroup } from "./claude-bot";

// unambiguous alphabet (no 0/O, 1/I/L) for invite codes read out loud at asados
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

export function createGroup(
  db: Db,
  organizerId: string,
  opts: { name: string; scoringRules: ScoringRules; potNote?: string },
  now = new Date(),
) {
  const group = db
    .insert(groups)
    .values({
      id: randomUUID(),
      name: opts.name,
      inviteCode: generateInviteCode(),
      organizerId,
      scoringRules: opts.scoringRules,
      potNote: opts.potNote || null,
      createdAt: now,
    })
    .returning()
    .get();
  db.insert(memberships)
    .values({
      userId: organizerId,
      groupId: group.id,
      role: "organizer",
      joinedAt: now,
    })
    .run();
  // every polla gets the Claude bot player (no-op until the bot is seeded)
  addClaudeToGroup(db, group.id, now);
  return group;
}

export function getGroupByInviteCode(db: Db, code: string) {
  return (
    db
      .select()
      .from(groups)
      .where(eq(groups.inviteCode, code.trim().toUpperCase()))
      .get() ?? null
  );
}

export function joinGroup(db: Db, userId: string, groupId: string, now = new Date()) {
  const existing = db
    .select()
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)),
    )
    .get();
  if (existing) return existing;
  return db
    .insert(memberships)
    .values({ userId, groupId, role: "member", joinedAt: now })
    .returning()
    .get();
}

export function getUserGroups(db: Db, userId: string) {
  return db
    .select({ group: groups, role: memberships.role })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(eq(memberships.userId, userId))
    .all();
}

// null when the user is not a member — pages treat that as 404
export function getGroupForMember(db: Db, userId: string, groupId: string) {
  const row = db
    .select({ group: groups, role: memberships.role })
    .from(memberships)
    .innerJoin(groups, eq(memberships.groupId, groups.id))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.groupId, groupId)),
    )
    .get();
  return row ?? null;
}

export function getGroupMembers(db: Db, groupId: string) {
  return db
    .select({
      userId: users.id,
      displayName: users.displayName,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.groupId, groupId))
    .all();
}

export function regenerateInviteCode(db: Db, groupId: string) {
  return db
    .update(groups)
    .set({ inviteCode: generateInviteCode() })
    .where(eq(groups.id, groupId))
    .returning({ inviteCode: groups.inviteCode })
    .get();
}
