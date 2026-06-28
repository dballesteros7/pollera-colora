import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { bonusPicks, groups, matches, tournamentOutcomes } from "./db/schema";

export const BONUS_CATEGORIES = [
  { id: "champion", label: "Campeón", team: true },
  { id: "runner_up", label: "Subcampeón", team: true },
  { id: "third", label: "Tercer puesto", team: true },
  { id: "top_scorer", label: "Goleador", team: false },
  { id: "best_gk", label: "Mejor arquero", team: false },
] as const;

export type BonusCategory = (typeof BONUS_CATEGORIES)[number]["id"];

export class BonusLockedError extends Error {}

// Tournament bonus picks close partway into the knockouts — extended past the
// group phase so latecomers can still pick champion/top-scorer/etc. A group may
// set an *earlier* bonusLockAt, but never a later one.
export const BONUS_CLOSE = new Date("2026-07-03T22:00:00Z");

// The effective bonus deadline: the earlier of the group-phase close and any
// per-group override. There is always a deadline now (the group phase always
// ends), so bonus is no longer open-forever when an organizer leaves it unset.
export function bonusDeadline(group: { bonusLockAt: Date | null }): Date {
  return group.bonusLockAt && group.bonusLockAt.getTime() < BONUS_CLOSE.getTime()
    ? group.bonusLockAt
    : BONUS_CLOSE;
}

export function bonusLocked(
  group: { bonusLockAt: Date | null },
  now: Date = new Date(),
): boolean {
  return now.getTime() >= bonusDeadline(group).getTime();
}

export function saveBonusPick(
  db: Db,
  opts: {
    userId: string;
    groupId: string;
    category: BonusCategory;
    value: string;
  },
  now = new Date(),
) {
  const group = db
    .select()
    .from(groups)
    .where(eq(groups.id, opts.groupId))
    .get();
  if (!group) throw new Error("Group not found");
  if (bonusLocked(group, now)) {
    throw new BonusLockedError("Los pronósticos de torneo ya cerraron.");
  }
  const value = opts.value.trim();
  if (!value) {
    db.delete(bonusPicks)
      .where(
        and(
          eq(bonusPicks.userId, opts.userId),
          eq(bonusPicks.groupId, opts.groupId),
          eq(bonusPicks.category, opts.category),
        ),
      )
      .run();
    return null;
  }
  return db
    .insert(bonusPicks)
    .values({
      userId: opts.userId,
      groupId: opts.groupId,
      category: opts.category,
      value,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [bonusPicks.userId, bonusPicks.groupId, bonusPicks.category],
      set: { value, updatedAt: now },
    })
    .returning()
    .get();
}

export function getUserBonusPicks(db: Db, userId: string, groupId: string) {
  const rows = db
    .select()
    .from(bonusPicks)
    .where(
      and(eq(bonusPicks.userId, userId), eq(bonusPicks.groupId, groupId)),
    )
    .all();
  return new Map(rows.map((r) => [r.category, r.value]));
}

export function getGroupBonusPicks(db: Db, groupId: string) {
  return db
    .select()
    .from(bonusPicks)
    .where(eq(bonusPicks.groupId, groupId))
    .all();
}

export function getOutcomes(db: Db) {
  const rows = db.select().from(tournamentOutcomes).all();
  return new Map(rows.map((r) => [r.category, r.value]));
}

export function setOutcome(
  db: Db,
  category: BonusCategory,
  value: string,
  now = new Date(),
) {
  const v = value.trim();
  if (!v) {
    db.delete(tournamentOutcomes)
      .where(eq(tournamentOutcomes.category, category))
      .run();
    return;
  }
  db.insert(tournamentOutcomes)
    .values({ category, value: v, updatedAt: now })
    .onConflictDoUpdate({
      target: tournamentOutcomes.category,
      set: { value: v, updatedAt: now },
    })
    .run();
}

// distinct team names for the team-pick dropdowns
export function getKnownTeams(db: Db): string[] {
  const rows = db
    .select({ home: matches.homeTeam, away: matches.awayTeam })
    .from(matches)
    .all();
  const names = new Set<string>();
  for (const r of rows) {
    if (r.home) names.add(r.home);
    if (r.away) names.add(r.away);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"));
}
