import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import {
  groups,
  matches,
  memberships,
  predictions,
  scores,
  propQuestions,
  propAnswers,
} from "../db/schema";
import { PRESETS, parseScoringRules, type PresetDef } from "./presets";

export interface MatchResult {
  regHome: number;
  regAway: number;
  stage: string;
}

export interface PredictionInput {
  predHome: number;
  predAway: number;
  joker: boolean;
}

export interface MatchScore {
  points: number;
  exact: boolean;
  result: boolean; // outcome (winner/draw) correct
}

function outcome(home: number, away: number): -1 | 0 | 1 {
  return home === away ? 0 : home > away ? 1 : -1;
}

// Core scoring for one prediction vs one regulation-time result.
// `unicoBonus` (único acertado) is group-context and applied by the rebuild.
export function scoreMatch(
  pred: PredictionInput,
  result: MatchResult,
  preset: PresetDef,
): MatchScore {
  const exact =
    pred.predHome === result.regHome && pred.predAway === result.regAway;
  const sameOutcome =
    outcome(pred.predHome, pred.predAway) ===
    outcome(result.regHome, result.regAway);
  const sameGoalDiff =
    pred.predHome - pred.predAway === result.regHome - result.regAway;

  let points = 0;
  if (preset.exclusiveTiers) {
    if (exact) {
      points = preset.exactPoints;
    } else {
      if (sameOutcome && sameGoalDiff) points = preset.tierWinnerGoalDiff;
      else if (sameOutcome) points = preset.resultPoints;
      if (
        pred.predHome === result.regHome ||
        pred.predAway === result.regAway
      ) {
        points += preset.teamGoalsBonus;
      }
    }
  } else {
    if (exact) {
      points = preset.exactPoints;
    } else if (sameOutcome) {
      points = preset.resultPoints;
      // goal-diff bonus only for non-draws (a correct draw outcome already
      // implies the goal difference)
      if (sameGoalDiff && outcome(result.regHome, result.regAway) !== 0) {
        points += preset.goalDiffBonus;
      }
    }
  }

  const multiplier = preset.stageMultipliers[result.stage] ?? 1;
  points = Math.round(points * multiplier);
  if (pred.joker && preset.joker) points *= 2;

  return { points, exact, result: sameOutcome };
}

export const UNICO_BONUS = 5;

// Rebuild the cached scores for every member of one group.
export function rebuildGroupScores(db: Db, groupId: string, now = new Date()) {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) return;
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];

  const finished = db
    .select()
    .from(matches)
    .where(eq(matches.status, "FINISHED"))
    .all()
    .filter((m) => m.regHome !== null && m.regAway !== null);

  const members = db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.groupId, groupId))
    .all();

  const preds = db
    .select()
    .from(predictions)
    .where(eq(predictions.groupId, groupId))
    .all();
  const byMatch = new Map<number, typeof preds>();
  for (const p of preds) {
    byMatch.set(p.matchId, [...(byMatch.get(p.matchId) ?? []), p]);
  }

  const totals = new Map<
    string,
    { points: number; exact: number; result: number }
  >();
  for (const m of members) {
    totals.set(m.userId, { points: 0, exact: 0, result: 0 });
  }

  for (const match of finished) {
    const matchPreds = byMatch.get(match.id) ?? [];
    const result: MatchResult = {
      regHome: match.regHome!,
      regAway: match.regAway!,
      stage: match.stage,
    };
    const scored = matchPreds
      .filter((p) => totals.has(p.userId))
      .map((p) => ({ p, s: scoreMatch(p, result, preset) }));
    const exactCount = scored.filter(({ s }) => s.exact).length;

    for (const { p, s } of scored) {
      const t = totals.get(p.userId)!;
      let pts = s.points;
      if (rules.unicoAcertado && s.exact && exactCount === 1) {
        pts += UNICO_BONUS;
      }
      t.points += pts;
      if (s.exact) t.exact++;
      if (s.result) t.result++;
    }
  }

  // resolved prop questions
  const resolvedProps = db
    .select()
    .from(propQuestions)
    .where(
      and(
        eq(propQuestions.groupId, groupId),
        eq(propQuestions.status, "resolved"),
      ),
    )
    .all();
  const propPoints = new Map<string, number>();
  for (const q of resolvedProps) {
    if (q.correctValue === null) continue;
    const answers = db
      .select()
      .from(propAnswers)
      .where(eq(propAnswers.questionId, q.id))
      .all()
      .filter((a) => totals.has(a.userId));

    let winners: string[] = [];
    if (q.resolutionMode === "closest" && q.answerType === "number") {
      const target = Number(q.correctValue);
      let best = Infinity;
      for (const a of answers) {
        const diff = Math.abs(Number(a.value) - target);
        if (isNaN(diff)) continue;
        if (diff < best) {
          best = diff;
          winners = [a.userId];
        } else if (diff === best) {
          winners.push(a.userId);
        }
      }
    } else {
      winners = answers
        .filter(
          (a) =>
            a.value.trim().toLowerCase() ===
            q.correctValue!.trim().toLowerCase(),
        )
        .map((a) => a.userId);
    }
    for (const w of winners) {
      propPoints.set(w, (propPoints.get(w) ?? 0) + q.points);
    }
  }

  for (const m of members) {
    const t = totals.get(m.userId)!;
    const props = propPoints.get(m.userId) ?? 0;
    db.insert(scores)
      .values({
        userId: m.userId,
        groupId,
        pointsMatches: t.points,
        pointsBonus: 0, // Phase 5: tournament bonus picks
        pointsProps: props,
        exactCount: t.exact,
        resultCount: t.result,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [scores.userId, scores.groupId],
        set: {
          pointsMatches: t.points,
          pointsProps: props,
          exactCount: t.exact,
          resultCount: t.result,
          updatedAt: now,
        },
      })
      .run();
  }
}

export function rebuildAllScores(db: Db, now = new Date()) {
  const allGroups = db.select({ id: groups.id }).from(groups).all();
  for (const g of allGroups) rebuildGroupScores(db, g.id, now);
}
