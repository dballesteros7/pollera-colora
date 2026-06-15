// Read-only matchday brief for Claudio di María. Prints JSON describing what to
// predict + context (upcoming fixtures, recent results for form, which presets/
// jokers/bonus are in play, and what the bot already picked). Feed this to the
// reasoning step. Usage: tsx scripts/claude-brief.ts
import { getDb } from "../lib/db";
import { CLAUDE_BOT_ID } from "../lib/claude-bot";
import { getUserGroups } from "../lib/groups";
import {
  getAllMatches,
  getUserPredictions,
  isPredictable,
  roundKey,
} from "../lib/predictions";
import { getUserBonusPicks, getOutcomes, bonusLocked, BONUS_CATEGORIES } from "../lib/bonus";
import { parseScoringRules } from "../lib/scoring/presets";

const db = getDb();
const now = new Date();
const botGroups = getUserGroups(db, CLAUDE_BOT_ID).map((m) => m.group);
const presets = [...new Set(botGroups.map((g) => parseScoringRules(g.scoringRules).preset))];
const escalonada = botGroups.find((g) => parseScoringRules(g.scoringRules).preset === "escalonada");

const all = getAllMatches(db);
const upcoming = all
  .filter((m) => isPredictable(m, now))
  .map((m) => ({
    matchId: m.id,
    stage: m.stage,
    matchday: m.matchday,
    round: roundKey(m),
    kickoffUtc: m.kickoffUtc.toISOString(),
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
  }));

const recentResults = all
  .filter((m) => (m.status === "FINISHED" || m.status === "AWARDED") && m.regHome !== null)
  .slice(-40)
  .map((m) => ({
    stage: m.stage,
    matchday: m.matchday,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    regHome: m.regHome,
    regAway: m.regAway,
  }));

// what the bot already picked (one representative group; scorelines are shared)
const ref = escalonada ?? botGroups[0];
const matchById = new Map(all.map((m) => [m.id, m]));
const existingPreds = ref
  ? [...getUserPredictions(db, CLAUDE_BOT_ID, ref.id).values()]
  : [];
const alreadyPicked = existingPreds.map((p) => ({
  matchId: p.matchId,
  predHome: p.predHome,
  predAway: p.predAway,
  joker: p.joker,
}));
const jokerRoundsSpent = escalonada
  ? existingPreds
      .filter((p) => p.joker)
      .map((p) => {
        const m = matchById.get(p.matchId);
        return m ? roundKey(m) : null;
      })
      .filter((r): r is string => r !== null)
  : [];

const bonus = {
  jokersInPlay: !!escalonada,
  categories: BONUS_CATEGORIES.map((c) => c.id),
  outcomesKnown: Object.fromEntries(getOutcomes(db)),
  existing: ref ? Object.fromEntries(getUserBonusPicks(db, CLAUDE_BOT_ID, ref.id)) : {},
  open: botGroups.some((g) => !bonusLocked(g, now)),
};

console.log(
  JSON.stringify(
    {
      now: now.toISOString(),
      groups: botGroups.map((g) => ({ id: g.id, name: g.name, preset: parseScoringRules(g.scoringRules).preset })),
      presets,
      upcoming,
      recentResults,
      alreadyPicked,
      jokerRoundsSpent,
      bonus,
    },
    null,
    2,
  ),
);
