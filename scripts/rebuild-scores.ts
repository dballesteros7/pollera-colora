// One-shot full score rebuild (all pollas + the Superpolla). Run after a
// scoring-logic change ships so cached totals pick up the new rules without
// waiting for the next result to land. Usage: tsx scripts/rebuild-scores.ts
import { getDb } from "../lib/db";
import { rebuildAllScores } from "../lib/scoring/score";
import { getSuperPolla } from "../lib/super-polla";
import { getLeaderboard } from "../lib/leaderboard";

const db = getDb();
rebuildAllScores(db, new Date());

const sp = getSuperPolla(db);
if (sp) {
  console.log("Superpolla after rebuild:");
  for (const r of getLeaderboard(db, sp.id)) {
    console.log(
      ` ${String(r.total).padStart(4)} pts  ${r.displayName ?? "(sin nombre)"} (exact ${r.exactCount})`,
    );
  }
}
