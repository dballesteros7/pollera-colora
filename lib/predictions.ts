import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { matches, predictions, users } from "./db/schema";

export class PredictionLockedError extends Error {}
export class MatchNotPredictableError extends Error {}

type Match = typeof matches.$inferSelect;

export function isLocked(match: Match, now: Date): boolean {
  return now.getTime() >= match.kickoffUtc.getTime();
}

export function isPredictable(match: Match, now: Date): boolean {
  return (
    !isLocked(match, now) &&
    match.homeTeam !== null &&
    match.awayTeam !== null &&
    match.status !== "CANCELLED" &&
    match.status !== "POSTPONED"
  );
}

// Joker scope: one per group-stage matchday, one per knockout stage.
export function roundKey(match: Pick<Match, "stage" | "matchday">): string {
  return match.stage === "GROUP_STAGE"
    ? `GROUP_${match.matchday ?? 0}`
    : match.stage;
}

export function savePrediction(
  db: Db,
  opts: {
    userId: string;
    groupId: string;
    matchId: number;
    predHome: number;
    predAway: number;
    joker?: boolean;
    allowJoker?: boolean; // group preset has jokers at all
  },
  now = new Date(),
) {
  const match = db
    .select()
    .from(matches)
    .where(eq(matches.id, opts.matchId))
    .get();
  if (!match) throw new MatchNotPredictableError("Match not found");
  if (isLocked(match, now)) {
    throw new PredictionLockedError("Este partido ya arrancó.");
  }
  if (!isPredictable(match, now)) {
    throw new MatchNotPredictableError(
      "Este partido aún no se puede pronosticar.",
    );
  }
  if (
    !Number.isInteger(opts.predHome) ||
    !Number.isInteger(opts.predAway) ||
    opts.predHome < 0 ||
    opts.predAway < 0 ||
    opts.predHome > 99 ||
    opts.predAway > 99
  ) {
    throw new MatchNotPredictableError("Marcador inválido.");
  }

  const joker = Boolean(opts.joker && opts.allowJoker);
  if (joker) {
    // a joker here displaces any other joker in the same round —
    // but only on matches that haven't locked yet
    const round = roundKey(match);
    const sameRoundIds = db
      .select({ id: matches.id, stage: matches.stage, matchday: matches.matchday, kickoffUtc: matches.kickoffUtc })
      .from(matches)
      .all()
      .filter(
        (m) =>
          roundKey(m) === round &&
          m.id !== match.id &&
          now.getTime() < m.kickoffUtc.getTime(),
      )
      .map((m) => m.id);
    if (sameRoundIds.length > 0) {
      db.update(predictions)
        .set({ joker: false, updatedAt: now })
        .where(
          and(
            eq(predictions.userId, opts.userId),
            eq(predictions.groupId, opts.groupId),
            inArray(predictions.matchId, sameRoundIds),
          ),
        )
        .run();
    }
  }

  return db
    .insert(predictions)
    .values({
      userId: opts.userId,
      groupId: opts.groupId,
      matchId: opts.matchId,
      predHome: opts.predHome,
      predAway: opts.predAway,
      joker,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.groupId, predictions.matchId],
      set: {
        predHome: opts.predHome,
        predAway: opts.predAway,
        joker,
        updatedAt: now,
      },
    })
    .returning()
    .get();
}

// save the same score into several of the user's groups (joker only in the
// originating group — jokers are preset- and round-specific per polla)
export function savePredictionForGroups(
  db: Db,
  opts: {
    userId: string;
    matchId: number;
    predHome: number;
    predAway: number;
    groups: { groupId: string; joker: boolean; allowJoker: boolean }[];
  },
  now = new Date(),
): number {
  let saved = 0;
  for (const g of opts.groups) {
    try {
      savePrediction(
        db,
        {
          userId: opts.userId,
          groupId: g.groupId,
          matchId: opts.matchId,
          predHome: opts.predHome,
          predAway: opts.predAway,
          joker: g.joker,
          allowJoker: g.allowJoker,
        },
        now,
      );
      saved++;
    } catch (err) {
      if (
        err instanceof PredictionLockedError ||
        err instanceof MatchNotPredictableError
      ) {
        continue; // that group misses out — match locked meanwhile
      }
      throw err;
    }
  }
  return saved;
}

// bulk-copy scores from one of the user's pollas into another: only matches
// still open here and not yet predicted here; jokers never copy
export function copyPredictions(
  db: Db,
  opts: { userId: string; fromGroupId: string; toGroupId: string },
  now = new Date(),
): number {
  const source = getUserPredictions(db, opts.userId, opts.fromGroupId);
  const existing = getUserPredictions(db, opts.userId, opts.toGroupId);
  let copied = 0;
  for (const [matchId, pred] of source) {
    if (existing.has(matchId)) continue;
    try {
      savePrediction(
        db,
        {
          userId: opts.userId,
          groupId: opts.toGroupId,
          matchId,
          predHome: pred.predHome,
          predAway: pred.predAway,
          joker: false,
          allowJoker: false,
        },
        now,
      );
      copied++;
    } catch (err) {
      if (
        err instanceof PredictionLockedError ||
        err instanceof MatchNotPredictableError
      ) {
        continue;
      }
      throw err;
    }
  }
  return copied;
}

export function getUserPredictions(db: Db, userId: string, groupId: string) {
  const rows = db
    .select()
    .from(predictions)
    .where(
      and(eq(predictions.userId, userId), eq(predictions.groupId, groupId)),
    )
    .all();
  return new Map(rows.map((p) => [p.matchId, p]));
}

// everyone's predictions for one locked match — never call for unlocked ones
export function getGroupPredictionsForMatch(
  db: Db,
  groupId: string,
  matchId: number,
) {
  return db
    .select({
      userId: predictions.userId,
      displayName: users.displayName,
      predHome: predictions.predHome,
      predAway: predictions.predAway,
      joker: predictions.joker,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(
      and(eq(predictions.groupId, groupId), eq(predictions.matchId, matchId)),
    )
    .all();
}

export function getAllMatches(db: Db) {
  return db.select().from(matches).orderBy(matches.kickoffUtc).all();
}
