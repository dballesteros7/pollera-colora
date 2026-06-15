// Apply Claudio di María's matchday picks from a predictions JSON file.
// Reuses the real prediction/bonus/scoring code — no logic is reimplemented.
// Re-runnable (all writes upsert). Usage:
//   tsx scripts/claude-apply.ts <predictions.json>
import { readFileSync } from "node:fs";
import { getDb } from "../lib/db";
import { CLAUDE_BOT_ID } from "../lib/claude-bot";
import { getUserGroups } from "../lib/groups";
import { savePredictionForGroups, roundKey, getAllMatches } from "../lib/predictions";
import { saveBonusPick, BonusLockedError, type BonusCategory } from "../lib/bonus";
import { parseScoringRules, PRESETS } from "../lib/scoring/presets";
import { rebuildAllScores } from "../lib/scoring/score";

interface Predictions {
  scores?: { matchId: number; predHome: number; predAway: number }[];
  joker?: Record<string, number>; // roundKey -> matchId to play the joker on
  bonus?: Partial<Record<BonusCategory, string>>;
}

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/claude-apply.ts <predictions.json>");
  process.exit(1);
}
const preds: Predictions = JSON.parse(readFileSync(file, "utf8"));
const now = new Date();
const db = getDb();

const botGroups = getUserGroups(db, CLAUDE_BOT_ID).map((m) => m.group);
if (botGroups.length === 0) {
  console.error("Claudio is not a member of any group — run seed-claude first");
  process.exit(1);
}
const matchById = new Map(getAllMatches(db).map((m) => [m.id, m]));
const jokerByRound = preds.joker ?? {};

// pre-compute per-group joker eligibility (escalonada has jokers)
const groupJoker = botGroups.map((g) => ({
  id: g.id,
  allowJoker: PRESETS[parseScoringRules(g.scoringRules).preset].joker,
}));

let saved = 0;
for (const s of preds.scores ?? []) {
  const m = matchById.get(s.matchId);
  if (!m) {
    console.warn(`skip match ${s.matchId}: not found`);
    continue;
  }
  const isJokerMatch = jokerByRound[roundKey(m)] === s.matchId;
  const n = savePredictionForGroups(
    db,
    {
      userId: CLAUDE_BOT_ID,
      matchId: s.matchId,
      predHome: s.predHome,
      predAway: s.predAway,
      groups: groupJoker.map((g) => ({
        groupId: g.id,
        joker: isJokerMatch && g.allowJoker,
        allowJoker: g.allowJoker,
      })),
    },
    now,
  );
  saved += n;
}

let bonusSaved = 0;
for (const [category, value] of Object.entries(preds.bonus ?? {})) {
  if (!value) continue;
  for (const g of botGroups) {
    try {
      saveBonusPick(
        db,
        { userId: CLAUDE_BOT_ID, groupId: g.id, category: category as BonusCategory, value },
        now,
      );
      bonusSaved++;
    } catch (err) {
      if (err instanceof BonusLockedError) continue; // bonus window closed for this group
      throw err;
    }
  }
}

rebuildAllScores(db, now);
console.log(
  `Claudio: ${preds.scores?.length ?? 0} scores across ${botGroups.length} group(s) → ${saved} prediction rows; ${bonusSaved} bonus rows. Scores rebuilt.`,
);
