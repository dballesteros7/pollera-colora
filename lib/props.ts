import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { matches, propQuestions, propAnswers, users } from "./db/schema";
import { rebuildGroupScores } from "./scoring/score";

export const DEFAULT_PROP_POINTS = 3;

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

  return db
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
      createdAt: now,
    })
    .returning()
    .get();
}

export function reviewQuestion(
  db: Db,
  questionId: string,
  decision: "approved" | "rejected",
  points?: number,
) {
  const q = db
    .select()
    .from(propQuestions)
    .where(eq(propQuestions.id, questionId))
    .get();
  if (!q || q.status !== "proposed") {
    throw new PropStateError("La pregunta no está pendiente.");
  }
  return db
    .update(propQuestions)
    .set({
      status: decision,
      points: points && points > 0 ? points : q.points,
    })
    .where(eq(propQuestions.id, questionId))
    .returning()
    .get();
}

export function answerQuestion(
  db: Db,
  opts: { questionId: string; userId: string; value: string },
  now = new Date(),
) {
  const q = db
    .select()
    .from(propQuestions)
    .where(eq(propQuestions.id, opts.questionId))
    .get();
  if (!q || q.status !== "approved") {
    throw new PropStateError("La pregunta no está abierta.");
  }
  if (now >= q.lockAt) throw new PropLockedError("Esta pregunta ya cerró.");

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
  if (!q || q.status !== "approved") {
    throw new PropStateError("Solo se resuelven preguntas aprobadas.");
  }
  if (now < q.lockAt) {
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
