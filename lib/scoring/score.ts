import { and, eq, inArray } from "drizzle-orm";
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
import {
  getGroupBonusPicks,
  getUserBonusPicks,
  getOutcomes,
  BONUS_CATEGORIES,
} from "../bonus";
import {
  getSuperPolla,
  homePollaIdOf,
  isKnockoutStage,
  syncSuperPollaMembership,
  SUPER_PRESET,
} from "../super-polla";
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

// the additive components that make up a match's base points, each tagged with
// a stable key the UI maps to a translated label. único is group-context and
// added by the caller, not here.
export type ScorePartKey =
  | "exact"
  | "winnerDiff" // escalonada tier: right winner + right goal difference
  | "tierWinner" // escalonada tier: right winner only
  | "result" // additive presets: right winner/draw
  | "goalDiff" // additive presets: goal-difference bonus (non-draw)
  | "teamGoals"; // escalonada: +1 for one team's goals

export interface ScorePart {
  key: ScorePartKey;
  points: number;
}

export interface ScoreBreakdown extends MatchScore {
  base: number; // sum of `parts` before multiplier/joker
  parts: ScorePart[];
  multiplier: number; // stage multiplier (1 when the preset has none)
  joker: boolean; // joker actually applied (preset allows it AND pred used it)
}

function outcome(home: number, away: number): -1 | 0 | 1 {
  return home === away ? 0 : home > away ? 1 : -1;
}

// Core scoring for one prediction vs one regulation-time result, broken down
// into its labelled parts so the UI can show *why* a pick scored what it did.
// `único acertado` is group-context and applied by the rebuild / the caller.
export function scoreBreakdown(
  pred: PredictionInput,
  result: MatchResult,
  preset: PresetDef,
): ScoreBreakdown {
  const exact =
    pred.predHome === result.regHome && pred.predAway === result.regAway;
  const sameOutcome =
    outcome(pred.predHome, pred.predAway) ===
    outcome(result.regHome, result.regAway);
  const sameGoalDiff =
    pred.predHome - pred.predAway === result.regHome - result.regAway;

  const parts: ScorePart[] = [];
  if (preset.exclusiveTiers) {
    if (exact) {
      parts.push({ key: "exact", points: preset.exactPoints });
    } else {
      if (sameOutcome && sameGoalDiff)
        parts.push({ key: "winnerDiff", points: preset.tierWinnerGoalDiff });
      else if (sameOutcome)
        parts.push({ key: "tierWinner", points: preset.resultPoints });
      if (
        pred.predHome === result.regHome ||
        pred.predAway === result.regAway
      ) {
        parts.push({ key: "teamGoals", points: preset.teamGoalsBonus });
      }
    }
  } else {
    if (exact) {
      parts.push({ key: "exact", points: preset.exactPoints });
    } else if (sameOutcome) {
      parts.push({ key: "result", points: preset.resultPoints });
      // goal-diff bonus only for non-draws (a correct draw outcome already
      // implies the goal difference)
      if (sameGoalDiff && outcome(result.regHome, result.regAway) !== 0) {
        parts.push({ key: "goalDiff", points: preset.goalDiffBonus });
      }
    }
  }

  const base = parts.reduce((sum, p) => sum + p.points, 0);
  const multiplier = preset.stageMultipliers[result.stage] ?? 1;
  const joker = pred.joker && preset.joker;
  let points = Math.round(base * multiplier);
  if (joker) points *= 2;

  return { points, exact, result: sameOutcome, base, parts, multiplier, joker };
}

export function scoreMatch(
  pred: PredictionInput,
  result: MatchResult,
  preset: PresetDef,
): MatchScore {
  const { points, exact, result: res } = scoreBreakdown(pred, result, preset);
  return { points, exact, result: res };
}

export const UNICO_BONUS = 5;

// accent-insensitive comparison for free-text values ("Julián" === "Julian")
function fold(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

// Rebuild the cached scores for every member of one group.
export function rebuildGroupScores(db: Db, groupId: string, now = new Date()) {
  const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
  if (!group) return;
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];

  const finished = db
    .select()
    .from(matches)
    .where(inArray(matches.status, ["FINISHED", "AWARDED"]))
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
    } else if (q.answerType === "number") {
      const target = Number(q.correctValue);
      winners = answers
        .filter((a) => !isNaN(Number(a.value)) && Number(a.value) === target)
        .map((a) => a.userId);
    } else {
      winners = answers
        .filter((a) => fold(a.value) === fold(q.correctValue!))
        .map((a) => a.userId);
    }
    for (const w of winners) {
      propPoints.set(w, (propPoints.get(w) ?? 0) + q.points);
    }
  }

  // tournament bonus picks vs real outcomes (entered by app admin)
  const outcomes = getOutcomes(db);
  const bonusByUser = new Map<string, number>();
  if (outcomes.size > 0) {
    for (const pick of getGroupBonusPicks(db, groupId)) {
      if (!totals.has(pick.userId)) continue;
      const real = outcomes.get(pick.category);
      if (real && fold(real) === fold(pick.value)) {
        bonusByUser.set(
          pick.userId,
          (bonusByUser.get(pick.userId) ?? 0) +
            preset.bonusPoints[pick.category],
        );
      }
    }
  }

  for (const m of members) {
    const t = totals.get(m.userId)!;
    const props = propPoints.get(m.userId) ?? 0;
    const bonus = bonusByUser.get(m.userId) ?? 0;
    db.insert(scores)
      .values({
        userId: m.userId,
        groupId,
        pointsMatches: t.points,
        pointsBonus: bonus,
        pointsProps: props,
        exactCount: t.exact,
        resultCount: t.result,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [scores.userId, scores.groupId],
        set: {
          pointsMatches: t.points,
          pointsBonus: bonus,
          pointsProps: props,
          exactCount: t.exact,
          resultCount: t.result,
          updatedAt: now,
        },
      })
      .run();
  }
}

// The Súper Polla's leaderboard, over the knockout rounds under the Marcador o
// nada + comodín ruleset. Each player has their own Súper-Polla picks; for any
// knockout match they haven't picked there yet, we fall back to their home-polla
// pick as a convenience (so nobody misses points before they notice the Súper
// Polla). Props are group-specific and don't carry over; bonus picks do.
export function rebuildSuperPollaScores(db: Db, now = new Date()) {
  const sp = getSuperPolla(db);
  if (!sp) return;
  const preset = SUPER_PRESET;

  const finishedKnockout = db
    .select()
    .from(matches)
    .where(inArray(matches.status, ["FINISHED", "AWARDED"]))
    .all()
    .filter(
      (m) =>
        m.regHome !== null && m.regAway !== null && isKnockoutStage(m.stage),
    );

  const members = db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.groupId, sp.id))
    .all();

  const outcomes = getOutcomes(db);

  for (const { userId } of members) {
    const homeId = homePollaIdOf(db, userId);
    let points = 0;
    let exact = 0;
    let result = 0;
    let bonus = 0;

    // the player's own Súper Polla picks win; home-polla picks fill the gaps
    const ownPreds = new Map(
      db
        .select()
        .from(predictions)
        .where(
          and(eq(predictions.userId, userId), eq(predictions.groupId, sp.id)),
        )
        .all()
        .map((p) => [p.matchId, p]),
    );
    const homePreds = homeId
      ? new Map(
          db
            .select()
            .from(predictions)
            .where(
              and(
                eq(predictions.userId, userId),
                eq(predictions.groupId, homeId),
              ),
            )
            .all()
            .map((p) => [p.matchId, p]),
        )
      : new Map();

    for (const match of finishedKnockout) {
      const p = ownPreds.get(match.id) ?? homePreds.get(match.id);
      if (!p) continue;
      const s = scoreMatch(
        p,
        { regHome: match.regHome!, regAway: match.regAway!, stage: match.stage },
        preset,
      );
      points += s.points;
      if (s.exact) exact++;
      if (s.result) result++;
    }

    // bonus (champion, top scorer, …): the player's own Súper Polla pick wins;
    // the home-polla pick fills any category they haven't set here
    if (outcomes.size > 0) {
      const ownBonus = getUserBonusPicks(db, userId, sp.id);
      const homeBonus = homeId ? getUserBonusPicks(db, userId, homeId) : new Map();
      for (const cat of BONUS_CATEGORIES) {
        const value = ownBonus.get(cat.id) ?? homeBonus.get(cat.id);
        if (!value) continue;
        const real = outcomes.get(cat.id);
        if (real && fold(real) === fold(value)) {
          bonus += preset.bonusPoints[cat.id];
        }
      }
    }

    db.insert(scores)
      .values({
        userId,
        groupId: sp.id,
        pointsMatches: points,
        pointsBonus: bonus,
        pointsProps: 0,
        exactCount: exact,
        resultCount: result,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [scores.userId, scores.groupId],
        set: {
          pointsMatches: points,
          pointsBonus: bonus,
          pointsProps: 0,
          exactCount: exact,
          resultCount: result,
          updatedAt: now,
        },
      })
      .run();
  }
}

export function rebuildAllScores(db: Db, now = new Date()) {
  const allGroups = db
    .select({ id: groups.id, isSuper: groups.isSuper })
    .from(groups)
    .all();
  // regular pollas score their own predictions; the Súper Polla reuses theirs
  for (const g of allGroups) {
    if (!g.isSuper) rebuildGroupScores(db, g.id, now);
  }
  syncSuperPollaMembership(db, now);
  rebuildSuperPollaScores(db, now);
}
