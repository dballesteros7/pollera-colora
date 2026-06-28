import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { groups, memberships, users } from "./db/schema";

// The Claude bot player. Fixed id so the UI badge and the matchday job can find
// it without a lookup. id is a plain text PK (not a real UUID) — that's fine.
export const CLAUDE_BOT_ID = "bot-claudio-di-maria";
export const CLAUDE_BOT_EMAIL = "claudio@pollera-colora.bot";
export const CLAUDE_BOT_NAME = "Claudio di María";

export function isClaudeBot(userId: string): boolean {
  return userId === CLAUDE_BOT_ID;
}

// Idempotent: create the bot user, or refresh its name/flags if it drifted.
export function ensureClaudeBot(db: Db, now = new Date()) {
  return db
    .insert(users)
    .values({
      id: CLAUDE_BOT_ID,
      email: CLAUDE_BOT_EMAIL,
      displayName: CLAUDE_BOT_NAME,
      isBot: true,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { displayName: CLAUDE_BOT_NAME, isBot: true },
    })
    .returning()
    .get();
}

// Add the bot to one group. Guarded so it's a no-op before the bot is seeded
// (keeps createGroup safe to call in tests / fresh DBs). Idempotent.
export function addClaudeToGroup(db: Db, groupId: string, now = new Date()) {
  const bot = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, CLAUDE_BOT_ID))
    .get();
  if (!bot) return;
  const existing = db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, CLAUDE_BOT_ID),
        eq(memberships.groupId, groupId),
      ),
    )
    .get();
  if (existing) return;
  db.insert(memberships)
    .values({
      userId: CLAUDE_BOT_ID,
      groupId,
      role: "member",
      joinedAt: now,
    })
    .run();
}

export function addClaudeToAllGroups(db: Db, now = new Date()) {
  // real pollas only — the bot joins the Súper Polla via membership sync, like
  // every other active player
  const all = db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.isSuper, false))
    .all();
  for (const g of all) addClaudeToGroup(db, g.id, now);
  return all.length;
}

// Matchday entry point for the bot scripts (brief + apply). Claudio joins a polla
// at creation time, but that's a no-op for pollas created before the bot was
// seeded — so without this, picks only ever reach pollas created after the seed
// (typically the maintainer's own, not friends' older ones). Seed + backfill
// here, idempotently, so EVERY existing polla is covered before we read or write.
// Returns the polla count, so callers can log coverage.
export function reconcileClaudeMembership(db: Db, now = new Date()) {
  ensureClaudeBot(db, now);
  return addClaudeToAllGroups(db, now);
}
