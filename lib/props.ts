import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { matches, propQuestions, propAnswers, propVotes, memberships, users } from "./db/schema";
import { rebuildGroupScores } from "./scoring/score";

export const DEFAULT_PROP_POINTS = 3;

// La Recocha shuts for the whole tournament at the end of this weekend — far
// earlier than the final. Every question's effective close is capped here, and
// no new ones can be proposed after it. (End of Sunday 2026-06-21 in Colombia,
// UTC-5 → Monday 00:00 COT.)
export const RECOCHA_CLOSE = new Date("2026-06-22T05:00:00Z");

// A question's real close: the earlier of its own lock and the weekend cutoff.
export function recochaLock(lockAt: Date): Date {
  return lockAt.getTime() < RECOCHA_CLOSE.getTime() ? lockAt : RECOCHA_CLOSE;
}

export class PropLockedError extends Error {}
export class PropStateError extends Error {}

export type AnswerType = "number" | "boolean" | "choice";

export function proposeQuestion(
  db: Db,
  opts: {
    groupId: string;
    proposerId: string;
    question: string;
    answerType: AnswerType;
    options?: string[]; // for "choice"
    points?: number;
    matchId?: number; // locks at this match's kickoff
    lockAt?: Date; // required when no matchId
  },
  now = new Date(),
) {
  const question = opts.question.trim();
  if (question.length < 5 || question.length > 200) {
    throw new PropStateError("La pregunta debe tener entre 5 y 200 caracteres.");
  }
  if (now >= RECOCHA_CLOSE) {
    throw new PropLockedError("La Recocha ya cerró.");
  }

  let lockAt = opts.lockAt ?? null;
  let matchId: number | null = null;
  if (opts.matchId) {
    const match = db
      .select()
      .from(matches)
      .where(eq(matches.id, opts.matchId))
      .get();
    if (!match) throw new PropStateError("Partido no encontrado.");
    matchId = match.id;
    lockAt = match.kickoffUtc;
  }
  if (!lockAt || lockAt <= now) {
    throw new PropStateError("El cierre debe estar en el futuro.");
  }

  let options: string[] | null = null;
  if (opts.answerType === "choice") {
    options = (opts.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new PropStateError("Una pregunta de opciones necesita al menos 2.");
    }
  }

  const eligibleCount = db
    .select({ n: sql<number>`count(*)` })
    .from(memberships)
    .where(eq(memberships.groupId, opts.groupId))
    .get()!.n;

  const q = db
    .insert(propQuestions)
    .values({
      id: randomUUID(),
      groupId: opts.groupId,
      proposerId: opts.proposerId,
      status: "proposed",
      question,
      answerType: opts.answerType,
      options,
      points: opts.points && opts.points > 0 ? opts.points : DEFAULT_PROP_POINTS,
      matchId,
      lockAt,
      eligibleCount,
      createdAt: now,
    })
    .returning()
    .get();
  // proposing is an implicit approve vote (a 1-person group self-approves)
  voteQuestion(db, { questionId: q.id, groupId: opts.groupId, userId: opts.proposerId, vote: "approve" }, now);
  return db.select().from(propQuestions).where(eq(propQuestions.id, q.id)).get()!;
}

export interface VoteTally {
  approvals: number;
  rejections: number;
  eligible: number;
  needed: number; // strict majority of the frozen member count
}

export function getVoteTally(
  db: Db,
  question: { id: string; eligibleCount: number | null; groupId: string },
): VoteTally {
  // legacy rows (pre-voting) have no frozen count — fall back to current size
  const eligible =
    question.eligibleCount ??
    db
      .select({ n: sql<number>`count(*)` })
      .from(memberships)
      .where(eq(memberships.groupId, question.groupId))
      .get()!.n;
  const votes = db
    .select()
    .from(propVotes)
    .where(eq(propVotes.questionId, question.id))
    .all();
  return {
    approvals: votes.filter((v) => v.vote === "approve").length,
    rejections: votes.filter((v) => v.vote === "reject").length,
    eligible,
    needed: Math.floor(eligible / 2) + 1,
  };
}

export function voteQuestion(
  db: Db,
  opts: { questionId: string; groupId: string; userId: string; vote: "approve" | "reject" },
  now = new Date(),
) {
  const q = db
    .select()
    .from(propQuestions)
    .where(eq(propQuestions.id, opts.questionId))
    .get();
  // the groupId check stops cross-group tampering via form-data questionIds
  if (!q || q.groupId !== opts.groupId || q.status !== "proposed") {
    throw new PropStateError("La pregunta no está en votación.");
  }
  if (now >= recochaLock(q.lockAt)) throw new PropLockedError("La votación ya cerró.");

  db.insert(propVotes)
    .values({
      questionId: opts.questionId,
      userId: opts.userId,
      vote: opts.vote,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [propVotes.questionId, propVotes.userId],
      set: { vote: opts.vote, updatedAt: now },
    })
    .run();

  const tally = getVoteTally(db, q);
  if (tally.approvals >= tally.needed) {
    db.update(propQuestions)
      .set({ status: "approved" })
      .where(eq(propQuestions.id, q.id))
      .run();
  } else if (tally.rejections >= tally.needed) {
    db.update(propQuestions)
      .set({ status: "rejected" })
      .where(eq(propQuestions.id, q.id))
      .run();
  }
  return getVoteTally(db, q);
}

export function getUserVotes(db: Db, groupId: string, userId: string) {
  const rows = db
    .select({ v: propVotes })
    .from(propVotes)
    .innerJoin(propQuestions, eq(propVotes.questionId, propQuestions.id))
    .where(and(eq(propQuestions.groupId, groupId), eq(propVotes.userId, userId)))
    .all();
  return new Map(rows.map((r) => [r.v.questionId, r.v.vote]));
}

export function answerQuestion(
  db: Db,
  opts: { questionId: string; groupId: string; userId: string; value: string },
  now = new Date(),
) {
  const q = db
    .select()
    .from(propQuestions)
    .where(eq(propQuestions.id, opts.questionId))
    .get();
  if (!q || q.groupId !== opts.groupId || q.status !== "approved") {
    throw new PropStateError("La pregunta no está abierta.");
  }
  if (now >= recochaLock(q.lockAt)) throw new PropLockedError("Esta pregunta ya cerró.");

  const value = opts.value.trim();
  if (!value) throw new PropStateError("Respuesta vacía.");
  if (q.answerType === "number" && isNaN(Number(value))) {
    throw new PropStateError("La respuesta debe ser un número.");
  }
  if (q.answerType === "boolean" && !["si", "no"].includes(value)) {
    throw new PropStateError("Responda sí o no.");
  }
  if (
    q.answerType === "choice" &&
    !(q.options as string[]).includes(value)
  ) {
    throw new PropStateError("Elija una de las opciones.");
  }

  return db
    .insert(propAnswers)
    .values({
      questionId: opts.questionId,
      userId: opts.userId,
      value,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [propAnswers.questionId, propAnswers.userId],
      set: { value, updatedAt: now },
    })
    .returning()
    .get();
}

export function resolveQuestion(
  db: Db,
  opts: {
    questionId: string;
    groupId: string;
    correctValue: string;
    resolutionMode?: "exact" | "closest"; // only meaningful for numbers
  },
  now = new Date(),
) {
  const q = db
    .select()
    .from(propQuestions)
    .where(eq(propQuestions.id, opts.questionId))
    .get();
  if (!q || q.groupId !== opts.groupId || q.status !== "approved") {
    throw new PropStateError("Solo se resuelven preguntas aprobadas.");
  }
  if (now < recochaLock(q.lockAt)) {
    throw new PropStateError("La pregunta aún no cierra.");
  }
  const updated = db
    .update(propQuestions)
    .set({
      status: "resolved",
      correctValue: opts.correctValue.trim(),
      resolutionMode:
        q.answerType === "number" ? (opts.resolutionMode ?? "exact") : "exact",
    })
    .where(eq(propQuestions.id, opts.questionId))
    .returning()
    .get();
  rebuildGroupScores(db, q.groupId, now);
  return updated;
}

export function getGroupQuestions(db: Db, groupId: string) {
  return db
    .select({
      q: propQuestions,
      proposerName: users.displayName,
    })
    .from(propQuestions)
    .innerJoin(users, eq(propQuestions.proposerId, users.id))
    .where(eq(propQuestions.groupId, groupId))
    .all();
}

export function getUserAnswers(db: Db, groupId: string, userId: string) {
  const rows = db
    .select({ a: propAnswers })
    .from(propAnswers)
    .innerJoin(propQuestions, eq(propAnswers.questionId, propQuestions.id))
    .where(
      and(
        eq(propQuestions.groupId, groupId),
        eq(propAnswers.userId, userId),
      ),
    )
    .all();
  return new Map(rows.map((r) => [r.a.questionId, r.a.value]));
}

export function getQuestionAnswers(db: Db, questionId: string) {
  return db
    .select({
      userId: propAnswers.userId,
      displayName: users.displayName,
      value: propAnswers.value,
    })
    .from(propAnswers)
    .innerJoin(users, eq(propAnswers.userId, users.id))
    .where(eq(propAnswers.questionId, questionId))
    .all();
}
