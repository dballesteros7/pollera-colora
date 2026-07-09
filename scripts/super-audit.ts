// Read-only dump of everything needed to audit the Superpolla before the
// quarterfinals: memberships, knockout picks (all groups), jokers, bonus picks,
// outcomes, and the cached super scores. Prints one JSON blob to stdout.
// Usage: tsx scripts/super-audit.ts
import { getDb } from "../lib/db";
import {
  bonusPicks,
  groups,
  matches,
  memberships,
  predictions,
  scores,
  tournamentOutcomes,
  users,
} from "../lib/db/schema";
import { getSuperPolla, isKnockoutStage } from "../lib/super-polla";
import { eq, inArray } from "drizzle-orm";

const db = getDb();
const sp = getSuperPolla(db);

const allUsers = db
  .select({
    id: users.id,
    email: users.email,
    displayName: users.displayName,
    isBot: users.isBot,
    isAdmin: users.isAdmin,
  })
  .from(users)
  .all();

const allGroups = db
  .select({
    id: groups.id,
    name: groups.name,
    isSuper: groups.isSuper,
    scoringRules: groups.scoringRules,
    bonusLockAt: groups.bonusLockAt,
  })
  .from(groups)
  .all();

const allMemberships = db
  .select({
    userId: memberships.userId,
    groupId: memberships.groupId,
    joinedAt: memberships.joinedAt,
  })
  .from(memberships)
  .all();

const allMatches = db.select().from(matches).all();
const knockout = allMatches.filter((m) => isKnockoutStage(m.stage));
const knockoutIds = knockout.map((m) => m.id);

// every prediction on a knockout match (any group), plus every joker anywhere
const knockoutPreds = knockoutIds.length
  ? db
      .select()
      .from(predictions)
      .where(inArray(predictions.matchId, knockoutIds))
      .all()
  : [];
const allJokers = db
  .select()
  .from(predictions)
  .where(eq(predictions.joker, true))
  .all();

const allBonus = db.select().from(bonusPicks).all();
const outcomes = db.select().from(tournamentOutcomes).all();
const superScores = sp
  ? db.select().from(scores).where(eq(scores.groupId, sp.id)).all()
  : [];

console.log(
  JSON.stringify(
    {
      now: new Date().toISOString(),
      superPollaId: sp?.id ?? null,
      users: allUsers,
      groups: allGroups,
      memberships: allMemberships,
      knockoutMatches: knockout.map((m) => ({
        id: m.id,
        stage: m.stage,
        matchday: m.matchday,
        kickoffUtc: m.kickoffUtc.toISOString(),
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        status: m.status,
        regHome: m.regHome,
        regAway: m.regAway,
      })),
      knockoutPredictions: knockoutPreds,
      jokerPredictions: allJokers,
      bonusPicks: allBonus,
      outcomes,
      superScores,
    },
    null,
    1,
  ),
);
