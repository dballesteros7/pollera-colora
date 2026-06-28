import { eq } from "drizzle-orm";
import { createDb, type Db } from "../../lib/db";
import {
  users,
  sessions,
  memberships,
  matches,
  scores,
  groups,
  predictions,
  superIdentities,
  bonusPicks,
} from "../../lib/db/schema";
import { createGroup } from "../../lib/groups";
import { ensureClaudeBot, addClaudeToGroup, CLAUDE_BOT_ID } from "../../lib/claude-bot";
import { getSuperPolla, syncSuperPollaMembership } from "../../lib/super-polla";

export const SESSION_TOKEN = "pw-visual-session-token";

// Seed a deterministic-STRUCTURE group for the visual tests: a live match leads
// the day strip, then a few upcoming matches including a patriot team (Colombia)
// so the Easter-egg button is reachable. Kickoffs are relative to now so the
// "next 24h" day board always populates; the time-dependent text (countdowns,
// chip times) is masked in the screenshots, so the baselines stay stable.
export function seedVisualDb(dbPath: string): { groupId: string; superId: string } {
  const db: Db = createDb(dbPath);
  const now = Date.now();
  const H = 3600_000;
  const at = (offMs: number) => new Date(now + offMs);

  db.insert(users)
    .values([
      { id: "u-diego", email: "diego@example.test", displayName: "Diego", createdAt: at(0) },
      { id: "u-cosima", email: "cosima@example.test", displayName: "Cosima", createdAt: at(0) },
      { id: "u-ana", email: "ana@example.test", displayName: "Ana", createdAt: at(0) },
    ])
    .onConflictDoNothing()
    .run();
  ensureClaudeBot(db, at(0));

  db.insert(sessions)
    .values({ id: SESSION_TOKEN, userId: "u-diego", expiresAt: at(30 * 24 * H) })
    .onConflictDoNothing()
    .run();

  const group = createGroup(
    db,
    "u-diego",
    { name: "D&D Best Gamers", scoringRules: { preset: "escalonada", unicoAcertado: true } },
    at(0),
  );
  // fixed invite code so the invite line doesn't churn the screenshot
  db.update(groups).set({ inviteCode: "PWVISUAL01" }).where(eq(groups.id, group.id)).run();
  db.insert(memberships)
    .values([
      { userId: "u-cosima", groupId: group.id, role: "member", joinedAt: at(0) },
      { userId: "u-ana", groupId: group.id, role: "member", joinedAt: at(0) },
    ])
    .onConflictDoNothing()
    .run();
  addClaudeToGroup(db, group.id, at(0));

  // seven matches so the strip overflows even the centered desktop column —
  // exercising the scroll arrows in the baselines. A patriot team (Colombia)
  // keeps the egg-button detail covered.
  const slate = [
    { fdId: 99001, off: -1 * H, home: "Portugal", away: "Uzbekistan", status: "IN_PLAY", fh: 4, fa: 0 },
    { fdId: 99002, off: 3 * H, home: "England", away: "Ghana", status: "TIMED" },
    { fdId: 99003, off: 6 * H, home: "Panama", away: "Croatia", status: "TIMED" },
    { fdId: 99005, off: 8 * H, home: "Spain", away: "Morocco", status: "TIMED" },
    { fdId: 99006, off: 10 * H, home: "France", away: "Senegal", status: "TIMED" },
    { fdId: 99007, off: 14 * H, home: "Brazil", away: "Japan", status: "TIMED" },
    { fdId: 99004, off: 20 * H, home: "Colombia", away: "Congo DR", status: "TIMED" },
  ] as const;
  for (const m of slate) {
    db.insert(matches)
      .values({
        fdId: m.fdId,
        stage: "GROUP_STAGE",
        matchday: 2,
        kickoffUtc: at(m.off),
        homeTeam: m.home,
        awayTeam: m.away,
        homeCrest: null,
        awayCrest: null,
        status: m.status,
        duration: null,
        regHome: "fh" in m ? m.fh : null,
        regAway: "fa" in m ? m.fa : null,
        finalHome: "fh" in m ? m.fh : null,
        finalAway: "fa" in m ? m.fa : null,
        updatedAt: at(0),
      })
      .onConflictDoNothing()
      .run();
  }

  // leaderboard cache (the home table) — fixed numbers
  db.insert(scores)
    .values([
      { userId: "u-cosima", groupId: group.id, pointsMatches: 155, exactCount: 6, updatedAt: at(0) },
      { userId: CLAUDE_BOT_ID, groupId: group.id, pointsMatches: 145, exactCount: 6, updatedAt: at(0) },
      { userId: "u-diego", groupId: group.id, pointsMatches: 120, exactCount: 4, updatedAt: at(0) },
      { userId: "u-ana", groupId: group.id, pointsMatches: 98, exactCount: 3, updatedAt: at(0) },
    ])
    .onConflictDoNothing()
    .run();

  // --- Súper Polla coverage for the visual baseline ---
  // a knockout match beyond the 24h window so it doesn't enter the regular
  // group home board (keeping those baselines stable), but is still predictable
  // → it shows in the Súper Polla pick carousel
  const ko = db
    .insert(matches)
    .values({
      fdId: 99010,
      stage: "QUARTER_FINALS",
      matchday: null,
      kickoffUtc: at(30 * H),
      homeTeam: "Argentina",
      awayTeam: "Mexico",
      homeCrest: null,
      awayCrest: null,
      status: "TIMED",
      duration: null,
      regHome: null,
      regAway: null,
      finalHome: null,
      finalAway: null,
      updatedAt: at(0),
    })
    .returning()
    .get();

  // Diego has a home-polla pick for it but no Súper pick yet → the input is
  // pre-filled and the "copied from your polla" hint renders (the case we fix)
  db.insert(predictions)
    .values({
      userId: "u-diego",
      groupId: group.id,
      matchId: ko.id,
      predHome: 2,
      predAway: 1,
      joker: false,
      updatedAt: at(0),
    })
    .onConflictDoNothing()
    .run();

  // home-polla bonus picks (champion/top scorer) — the Súper Polla bonus form
  // pre-fills from these until Diego sets his own
  db.insert(bonusPicks)
    .values([
      { userId: "u-diego", groupId: group.id, category: "champion", value: "Brazil", updatedAt: at(0) },
      { userId: "u-diego", groupId: group.id, category: "top_scorer", value: "Vinícius Jr", updatedAt: at(0) },
    ])
    .onConflictDoNothing()
    .run();

  // enroll everyone in the Súper Polla; give Diego a decided identity so the
  // pick page (not the first-open interstitial) renders
  syncSuperPollaMembership(db, at(0));
  const superId = getSuperPolla(db)!.id;
  db.insert(superIdentities)
    .values({ userId: "u-diego", mode: "real", nickname: null, updatedAt: at(0) })
    .onConflictDoNothing()
    .run();
  db.insert(scores)
    .values([
      { userId: "u-cosima", groupId: superId, pointsMatches: 60, exactCount: 3, updatedAt: at(0) },
      { userId: "u-diego", groupId: superId, pointsMatches: 40, exactCount: 2, updatedAt: at(0) },
      { userId: "u-ana", groupId: superId, pointsMatches: 20, exactCount: 1, updatedAt: at(0) },
    ])
    .onConflictDoNothing()
    .run();

  return { groupId: group.id, superId };
}
