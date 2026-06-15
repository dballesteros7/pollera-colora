import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { scores, users, memberships } from "./db/schema";

export function getLeaderboard(db: Db, groupId: string) {
  // left-join from memberships so members appear even before any rebuild
  const rows = db
    .select({
      userId: memberships.userId,
      displayName: users.displayName,
      isBot: users.isBot,
      joinedAt: memberships.joinedAt,
      pointsMatches: scores.pointsMatches,
      pointsBonus: scores.pointsBonus,
      pointsProps: scores.pointsProps,
      exactCount: scores.exactCount,
      resultCount: scores.resultCount,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .leftJoin(
      scores,
      and(eq(scores.userId, memberships.userId), eq(scores.groupId, groupId)),
    )
    .where(eq(memberships.groupId, groupId))
    .all();

  return rows
    .map((r) => ({
      ...r,
      total:
        (r.pointsMatches ?? 0) + (r.pointsBonus ?? 0) + (r.pointsProps ?? 0),
      exactCount: r.exactCount ?? 0,
      resultCount: r.resultCount ?? 0,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.exactCount - a.exactCount ||
        b.resultCount - a.resultCount ||
        a.joinedAt.getTime() - b.joinedAt.getTime(),
    );
}
