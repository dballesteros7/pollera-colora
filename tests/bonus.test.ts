import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, groups, scores } from "../lib/db/schema";
import { createGroup } from "../lib/groups";
import {
  saveBonusPick,
  setOutcome,
  BonusLockedError,
  getUserBonusPicks,
  bonusDeadline,
  bonusLocked,
  BONUS_CLOSE,
} from "../lib/bonus";
import { rebuildGroupScores } from "../lib/scoring/score";

const NOW = new Date("2026-06-11T20:00:00Z");

describe("bonus picks", () => {
  let db: Db;
  let userId: string;
  let groupId: string;

  beforeEach(() => {
    db = createDb(":memory:");
    userId = db
      .insert(users)
      .values({ id: randomUUID(), email: "a@b.co", createdAt: NOW })
      .returning()
      .get().id;
    groupId = createGroup(db, userId, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }).id;
  });

  it("saves, upserts, and clears picks while open", () => {
    saveBonusPick(db, { userId, groupId, category: "champion", value: "Colombia" }, NOW);
    saveBonusPick(db, { userId, groupId, category: "champion", value: "Argentina" }, NOW);
    expect(getUserBonusPicks(db, userId, groupId).get("champion")).toBe("Argentina");
    saveBonusPick(db, { userId, groupId, category: "champion", value: "  " }, NOW);
    expect(getUserBonusPicks(db, userId, groupId).has("champion")).toBe(false);
  });

  it("rejects picks after the group deadline", () => {
    db.update(groups)
      .set({ bonusLockAt: new Date(NOW.getTime() - 1000) })
      .where(eq(groups.id, groupId))
      .run();
    expect(() =>
      saveBonusPick(db, { userId, groupId, category: "champion", value: "Colombia" }, NOW),
    ).toThrow(BonusLockedError);
  });

  it("scores picks against outcomes case-insensitively", () => {
    saveBonusPick(db, { userId, groupId, category: "champion", value: "colombia" }, NOW);
    saveBonusPick(db, { userId, groupId, category: "top_scorer", value: "Luis Díaz" }, NOW);
    saveBonusPick(db, { userId, groupId, category: "third", value: "Francia" }, NOW);

    setOutcome(db, "champion", "Colombia", NOW);
    setOutcome(db, "top_scorer", "luis díaz", NOW);
    setOutcome(db, "third", "Brasil", NOW);

    rebuildGroupScores(db, groupId, NOW);
    const row = db.select().from(scores).all()[0];
    // champion 10 + top scorer 6, third missed
    expect(row.pointsBonus).toBe(16);
  });

  it("no bonus points before outcomes exist", () => {
    saveBonusPick(db, { userId, groupId, category: "champion", value: "Colombia" }, NOW);
    rebuildGroupScores(db, groupId, NOW);
    expect(db.select().from(scores).all()[0].pointsBonus).toBe(0);
  });
});

describe("bonus closes at the group phase end", () => {
  const before = new Date(BONUS_CLOSE.getTime() - 3600_000);
  const after = new Date(BONUS_CLOSE.getTime() + 3600_000);

  it("falls back to the group-phase close when no override is set", () => {
    expect(bonusDeadline({ bonusLockAt: null })).toEqual(BONUS_CLOSE);
  });

  it("a later override is capped at the group-phase close", () => {
    const later = new Date(BONUS_CLOSE.getTime() + 5 * 24 * 3600_000);
    expect(bonusDeadline({ bonusLockAt: later })).toEqual(BONUS_CLOSE);
  });

  it("an earlier override wins", () => {
    const earlier = new Date(BONUS_CLOSE.getTime() - 5 * 24 * 3600_000);
    expect(bonusDeadline({ bonusLockAt: earlier })).toEqual(earlier);
  });

  it("locks at the group-phase close even with no override", () => {
    expect(bonusLocked({ bonusLockAt: null }, before)).toBe(false);
    expect(bonusLocked({ bonusLockAt: null }, after)).toBe(true);
  });
});
