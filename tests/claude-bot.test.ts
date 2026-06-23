import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createDb, type Db } from "../lib/db";
import { users } from "../lib/db/schema";
import { createGroup, getGroupMembers, getUserGroups } from "../lib/groups";
import {
  ensureClaudeBot,
  addClaudeToGroup,
  addClaudeToAllGroups,
  reconcileClaudeMembership,
  CLAUDE_BOT_ID,
} from "../lib/claude-bot";

const NOW = new Date("2026-06-11T20:00:00Z");

function makeUser(db: Db, email: string) {
  return db
    .insert(users)
    .values({ id: randomUUID(), email, createdAt: NOW })
    .returning()
    .get();
}

describe("Claudio di María membership", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("addClaudeToGroup is a no-op before the bot is seeded", () => {
    const u = makeUser(db, "a@b.co");
    const g = createGroup(db, u.id, {
      name: "Pre-seed",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    // bot not seeded yet → membership add silently skipped
    expect(
      getGroupMembers(db, g.id).map((m) => m.userId),
    ).not.toContain(CLAUDE_BOT_ID);
  });

  it("reconcile backfills pollas that predated the bot seed", () => {
    // A friend's polla created BEFORE the bot ever existed — the regression:
    // joins only happen at creation, so this polla never got Claudio.
    const ana = makeUser(db, "ana@x.co");
    const friendPolla = createGroup(db, ana.id, {
      name: "Parche de Ana",
      scoringRules: { preset: "escalonada", unicoAcertado: true },
    });
    expect(
      getGroupMembers(db, friendPolla.id).map((m) => m.userId),
    ).not.toContain(CLAUDE_BOT_ID);

    // The bot gets seeded later; a new polla created now joins normally.
    ensureClaudeBot(db, NOW);
    const diego = makeUser(db, "d@x.co");
    const ownPolla = createGroup(db, diego.id, {
      name: "Parche de Diego",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });

    // What the matchday scripts now run up front. After this, EVERY polla is
    // covered — not just the ones created after the seed.
    reconcileClaudeMembership(db, NOW);

    const covered = getUserGroups(db, CLAUDE_BOT_ID).map((m) => m.group.id);
    expect(covered).toContain(friendPolla.id); // the previously-missed one
    expect(covered).toContain(ownPolla.id);
    expect(covered).toHaveLength(2);
  });

  it("reconcile is idempotent — re-running adds no duplicate memberships", () => {
    ensureClaudeBot(db, NOW);
    const u = makeUser(db, "a@b.co");
    const g = createGroup(db, u.id, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });

    reconcileClaudeMembership(db, NOW);
    reconcileClaudeMembership(db, NOW);
    addClaudeToAllGroups(db, NOW);
    addClaudeToGroup(db, g.id, NOW);

    const botRows = getGroupMembers(db, g.id).filter(
      (m) => m.userId === CLAUDE_BOT_ID,
    );
    expect(botRows).toHaveLength(1);
  });

  it("reconcile seeds the bot when it doesn't exist yet", () => {
    const u = makeUser(db, "a@b.co");
    const g = createGroup(db, u.id, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    // never called ensureClaudeBot — reconcile must do it itself
    reconcileClaudeMembership(db, NOW);
    expect(
      getGroupMembers(db, g.id).map((m) => m.userId),
    ).toContain(CLAUDE_BOT_ID);
  });
});
