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
    // keep an existing joker on this row when updating the score (used by
    // "apply to all my pollas", where the checkbox only speaks for the origin)
    preserveJoker?: boolean;
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

  let joker = Boolean(opts.joker && opts.allowJoker);
  if (joker) {
    const round = roundKey(match);
    // a joker already played on a locked match in this round is spent —
    // it can't move, and a second active joker would double-dip
    const existingJokers = db
      .select({
        matchId: matches.id,
        stage: matches.stage,
        matchday: matches.matchday,
        kickoffUtc: matches.kickoffUtc,
      })
      .from(predictions)
      .innerJoin(matches, eq(predictions.matchId, matches.id))
      .where(
        and(
          eq(predictions.userId, opts.userId),
          eq(predictions.groupId, opts.groupId),
          eq(predictions.joker, true),
        ),
      )
      .all()
      .filter((m) => roundKey(m) === round && m.matchId !== match.id);

    if (existingJokers.some((m) => now.getTime() >= m.kickoffUtc.getTime())) {
      joker = false; // spent on a locked match — this save is score-only
    } else if (existingJokers.length > 0) {
      // displace the still-open joker(s) in this round
      db.update(predictions)
        .set({ joker: false, updatedAt: now })
        .where(
          and(
            eq(predictions.userId, opts.userId),
            eq(predictions.groupId, opts.groupId),
            inArray(
              predictions.matchId,
              existingJokers.map((m) => m.matchId),
            ),
          ),
        )
        .run();
    }
  }

  const conflictSet = opts.preserveJoker
    ? { predHome: opts.predHome, predAway: opts.predAway, updatedAt: now }
    : { predHome: opts.predHome, predAway: opts.predAway, joker, updatedAt: now };

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
      set: conflictSet,
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
    groups: {
      groupId: string;
      joker: boolean;
      allowJoker: boolean;
      preserveJoker?: boolean; // non-origin groups: don't touch their joker
    }[];
  },
  now = new Date(),
): number {
  return db.transaction(() => {
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
            preserveJoker: g.preserveJoker,
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
  });
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
  return db.transaction(() => {
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
  });
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
      isBot: users.isBot,
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

// batch variant for list pages: one query instead of one per locked match
export function getGroupPredictionsForMatches(
  db: Db,
  groupId: string,
  matchIds: number[],
) {
  if (matchIds.length === 0) {
    return new Map<number, ReturnType<typeof getGroupPredictionsForMatch>>();
  }
  const rows = db
    .select({
      matchId: predictions.matchId,
      userId: predictions.userId,
      displayName: users.displayName,
      isBot: users.isBot,
      predHome: predictions.predHome,
      predAway: predictions.predAway,
      joker: predictions.joker,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(
      and(
        eq(predictions.groupId, groupId),
        inArray(predictions.matchId, matchIds),
      ),
    )
    .all();
  const byMatch = new Map<number, ReturnType<typeof getGroupPredictionsForMatch>>();
  for (const { matchId, ...rest } of rows) {
    byMatch.set(matchId, [...(byMatch.get(matchId) ?? []), rest]);
  }
  return byMatch;
}

export function getAllMatches(db: Db) {
  return db.select().from(matches).orderBy(matches.kickoffUtc).all();
}
