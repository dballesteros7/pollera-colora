import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../lib/db";
import { users, scores, propQuestions } from "../lib/db/schema";
import { createGroup, joinGroup } from "../lib/groups";
import {
  proposeQuestion,
  voteQuestion,
  getVoteTally,
  answerQuestion,
  resolveQuestion,
  PropLockedError,
  PropStateError,
} from "../lib/props";

const NOW = new Date("2026-06-11T20:00:00Z");
const LOCK = new Date("2026-06-12T19:00:00Z");
const AFTER_LOCK = new Date("2026-06-12T21:00:00Z");

describe("prop questions", () => {
  let db: Db;
  let ana: string;
  let beto: string;
  let groupId: string;

  beforeEach(() => {
    db = createDb(":memory:");
    ana = db
      .insert(users)
      .values({ id: randomUUID(), email: "ana@b.co", createdAt: NOW })
      .returning()
      .get().id;
    beto = db
      .insert(users)
      .values({ id: randomUUID(), email: "beto@b.co", createdAt: NOW })
      .returning()
      .get().id;
    groupId = createGroup(db, ana, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }).id;
    joinGroup(db, beto, groupId, NOW);
  });

  function propose(over: Record<string, unknown> = {}) {
    return proposeQuestion(
      db,
      {
        groupId,
        proposerId: beto,
        question: "¿Cuántos bailes de salsa choke veremos?",
        answerType: "number",
        lockAt: LOCK,
        ...over,
      },
      NOW,
    );
  }

  it("full cycle: propose → approve → answer → resolve → points", () => {
    const q = propose({ points: 5 });
    expect(q.status).toBe("proposed");

    // answers rejected while still proposed
    expect(() =>
      answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "3" }, NOW),
    ).toThrow(PropStateError);

    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, NOW);
    answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "3" }, NOW);
    answerQuestion(db, { questionId: q.id, groupId, userId: beto, value: "7" }, NOW);

    // can't resolve before lock
    expect(() =>
      resolveQuestion(db, { questionId: q.id, groupId, correctValue: "4" }, NOW),
    ).toThrow(PropStateError);

    resolveQuestion(
      db,
      { questionId: q.id, groupId, correctValue: "4", resolutionMode: "closest" },
      AFTER_LOCK,
    );

    const rows = db.select().from(scores).all();
    expect(rows.find((r) => r.userId === ana)?.pointsProps).toBe(5); // |3-4| < |7-4|
    expect(rows.find((r) => r.userId === beto)?.pointsProps).toBe(0);
  });

  it("closest mode splits ties", () => {
    const q = propose();
    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, NOW);
    answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "2" }, NOW);
    answerQuestion(db, { questionId: q.id, groupId, userId: beto, value: "6" }, NOW);
    resolveQuestion(
      db,
      { questionId: q.id, groupId, correctValue: "4", resolutionMode: "closest" },
      AFTER_LOCK,
    );
    const rows = db.select().from(scores).all();
    expect(rows.find((r) => r.userId === ana)?.pointsProps).toBe(3);
    expect(rows.find((r) => r.userId === beto)?.pointsProps).toBe(3);
  });

  it("locks answers at lockAt", () => {
    const q = propose();
    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, NOW);
    expect(() =>
      answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "3" }, AFTER_LOCK),
    ).toThrow(PropLockedError);
  });

  it("validates answers by type", () => {
    const q = propose({
      answerType: "choice",
      options: ["James", "Luis Díaz", "Nadie"],
    });
    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, NOW);
    expect(() =>
      answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "Falcao" }, NOW),
    ).toThrow(PropStateError);
    answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "James" }, NOW);
    resolveQuestion(db, { questionId: q.id, groupId, correctValue: "james" }, AFTER_LOCK);
    expect(
      db.select().from(scores).all().find((r) => r.userId === ana)?.pointsProps,
    ).toBe(3);
  });

  it("majority rejection kills the question", () => {
    // 2-member group: proposer auto-approves (1), ana alone can't reject (needs 2)
    const q = propose();
    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "reject" }, NOW);
    let tally = getVoteTally(db, db.select().from(propQuestions).where(eq(propQuestions.id, q.id)).get()!);
    expect(tally).toMatchObject({ approvals: 1, rejections: 1, eligible: 2, needed: 2 });
    // proposer flips their own vote — rejections reach majority
    voteQuestion(db, { questionId: q.id, groupId, userId: beto, vote: "reject" }, NOW);
    expect(() =>
      answerQuestion(db, { questionId: q.id, groupId, userId: ana, value: "3" }, NOW),
    ).toThrow(PropStateError);
  });

  it("quorum is frozen at proposal time", () => {
    const q = propose(); // eligible = 2 (ana + beto), needs 2
    // a third member joins AFTER the proposal
    const celia = db
      .insert(users)
      .values({ id: randomUUID(), email: "celia@b.co", createdAt: NOW })
      .returning()
      .get();
    joinGroup(db, celia.id, groupId, NOW);
    // still only needs 2 of the frozen 2 — ana's approval settles it
    const tally = voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, NOW);
    expect(tally.needed).toBe(2);
    expect(tally.eligible).toBe(2);
    const updated = db.select().from(propQuestions).where(eq(propQuestions.id, q.id)).get()!;
    expect(updated.status).toBe("approved");
  });

  it("a 1-person group self-approves on proposal", () => {
    const soloId = db
      .insert(users)
      .values({ id: randomUUID(), email: "solo@b.co", createdAt: NOW })
      .returning()
      .get().id;
    const soloGroup = createGroup(db, soloId, {
      name: "Solo",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    }).id;
    const q = proposeQuestion(
      db,
      { groupId: soloGroup, proposerId: soloId, question: "¿Cuántos goles hoy en total?", answerType: "number", lockAt: LOCK },
      NOW,
    );
    expect(q.status).toBe("approved");
  });

  it("votes can't be cast after lock or once decided", () => {
    const q = propose();
    expect(() =>
      voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, AFTER_LOCK),
    ).toThrow(PropLockedError);
    voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "approve" }, NOW); // approved now
    expect(() =>
      voteQuestion(db, { questionId: q.id, groupId, userId: ana, vote: "reject" }, NOW),
    ).toThrow(PropStateError);
  });

  it("validates proposals", () => {
    expect(() => propose({ question: "eh?" })).toThrow(PropStateError);
    expect(() => propose({ lockAt: new Date(NOW.getTime() - 1) })).toThrow(
      PropStateError,
    );
    expect(() =>
      propose({ answerType: "choice", options: ["solo una"] }),
    ).toThrow(PropStateError);
  });
});
