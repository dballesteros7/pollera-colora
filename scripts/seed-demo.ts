// Demo data for local testing without a football-data.org key:
//   npx tsx scripts/seed-demo.ts
// Creates a handful of matches around "now" so you can exercise
// predicting (future), locked (live), and scored (finished) states.
import { getDb } from "../lib/db";
import { matches } from "../lib/db/schema";

const db = getDb();
const now = Date.now();
const HOUR = 3600_000;

const demo = [
  { fdId: 900001, home: "México", away: "Sudáfrica", offset: -3 * HOUR, status: "FINISHED", reg: [2, 1] },
  { fdId: 900002, home: "Canadá", away: "Italia", offset: -1 * HOUR, status: "IN_PLAY", reg: [0, 0] },
  { fdId: 900003, home: "Colombia", away: "Japón", offset: 4 * HOUR, status: "TIMED" },
  { fdId: 900004, home: "Argentina", away: "Ghana", offset: 26 * HOUR, status: "TIMED" },
  { fdId: 900005, home: "Brasil", away: "Noruega", offset: 30 * HOUR, status: "TIMED" },
] as const;

for (const d of demo) {
  const finished = d.status === "FINISHED";
  db.insert(matches)
    .values({
      fdId: d.fdId,
      stage: "GROUP_STAGE",
      matchday: 1,
      kickoffUtc: new Date(now + d.offset),
      homeTeam: d.home,
      awayTeam: d.away,
      status: d.status,
      duration: finished ? "REGULAR" : null,
      regHome: "reg" in d ? d.reg[0] : null,
      regAway: "reg" in d ? d.reg[1] : null,
      finalHome: "reg" in d ? d.reg[0] : null,
      finalAway: "reg" in d ? d.reg[1] : null,
      updatedAt: new Date(now),
    })
    .onConflictDoNothing()
    .run();
}
console.log(`seeded ${demo.length} demo matches into ${process.env.DATABASE_PATH ?? "data/polla.db"}`);
