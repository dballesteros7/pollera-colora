import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createDb, type Db } from "../lib/db";
import { users, scores } from "../lib/db/schema";
import { createGroup, joinGroup } from "../lib/groups";
import {
  proposeQuestion,
  reviewQuestion,
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
    const q = propose();
    expect(q.status).toBe("proposed");

    // answers rejected while still proposed
    expect(() =>
      answerQuestion(db, { questionId: q.id, userId: ana, value: "3" }, NOW),
    ).toThrow(PropStateError);

    reviewQuestion(db, q.id, "approved", 5);
    answerQuestion(db, { questionId: q.id, userId: ana, value: "3" }, NOW);
    answerQuestion(db, { questionId: q.id, userId: beto, value: "7" }, NOW);

    // can't resolve before lock
    expect(() =>
      resolveQuestion(db, { questionId: q.id, correctValue: "4" }, NOW),
    ).toThrow(PropStateError);

    resolveQuestion(
      db,
      { questionId: q.id, correctValue: "4", resolutionMode: "closest" },
      AFTER_LOCK,
    );

    const rows = db.select().from(scores).all();
    expect(rows.find((r) => r.userId === ana)?.pointsProps).toBe(5); // |3-4| < |7-4|
    expect(rows.find((r) => r.userId === beto)?.pointsProps).toBe(0);
  });

  it("closest mode splits ties", () => {
    const q = propose();
    reviewQuestion(db, q.id, "approved");
    answerQuestion(db, { questionId: q.id, userId: ana, value: "2" }, NOW);
    answerQuestion(db, { questionId: q.id, userId: beto, value: "6" }, NOW);
    resolveQuestion(
      db,
      { questionId: q.id, correctValue: "4", resolutionMode: "closest" },
      AFTER_LOCK,
    );
    const rows = db.select().from(scores).all();
    expect(rows.find((r) => r.userId === ana)?.pointsProps).toBe(3);
    expect(rows.find((r) => r.userId === beto)?.pointsProps).toBe(3);
  });

  it("locks answers at lockAt", () => {
    const q = propose();
    reviewQuestion(db, q.id, "approved");
    expect(() =>
      answerQuestion(db, { questionId: q.id, userId: ana, value: "3" }, AFTER_LOCK),
    ).toThrow(PropLockedError);
  });

  it("validates answers by type", () => {
    const q = propose({
      answerType: "choice",
      options: ["James", "Luis Díaz", "Nadie"],
    });
    reviewQuestion(db, q.id, "approved");
    expect(() =>
      answerQuestion(db, { questionId: q.id, userId: ana, value: "Falcao" }, NOW),
    ).toThrow(PropStateError);
    answerQuestion(db, { questionId: q.id, userId: ana, value: "James" }, NOW);
    resolveQuestion(db, { questionId: q.id, correctValue: "james" }, AFTER_LOCK);
    expect(
      db.select().from(scores).all().find((r) => r.userId === ana)?.pointsProps,
    ).toBe(3);
  });

  it("rejected questions never open", () => {
    const q = propose();
    reviewQuestion(db, q.id, "rejected");
    expect(() =>
      answerQuestion(db, { questionId: q.id, userId: ana, value: "3" }, NOW),
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
