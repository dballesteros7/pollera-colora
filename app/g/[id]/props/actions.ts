"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import { getViewerTz, parseDatetimeLocal } from "@/lib/viewer-tz";
import {
  proposeQuestion,
  voteQuestion,
  answerQuestion,
  resolveQuestion,
  PropLockedError,
  PropStateError,
  type AnswerType,
} from "@/lib/props";

async function requireMember(groupId: string) {
  const user = await requireUser(`/g/${groupId}/props`);
  const access = getGroupForMember(getDb(), user.id, groupId);
  if (!access) notFound();
  return { user, access };
}

function swallowPropErrors(err: unknown) {
  if (err instanceof PropLockedError || err instanceof PropStateError) return;
  throw err;
}

export async function proposeAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const { user } = await requireMember(groupId);
  const answerTypeRaw = String(formData.get("answerType"));
  // SQLite doesn't enforce Drizzle's text enums — reject forged values here
  if (!["number", "boolean", "choice"].includes(answerTypeRaw)) return;
  const answerType = answerTypeRaw as AnswerType;
  const matchId = Number(formData.get("matchId"));
  const lockAtRaw = String(formData.get("lockAt") ?? "");
  // manual deadlines are wall-clock in the proposer's timezone
  const lockAt = lockAtRaw
    ? (parseDatetimeLocal(lockAtRaw, await getViewerTz()) ?? undefined)
    : undefined;
  try {
    proposeQuestion(getDb(), {
      groupId,
      proposerId: user.id,
      question: String(formData.get("question") ?? ""),
      answerType,
      options:
        answerType === "choice"
          ? String(formData.get("options") ?? "").split("\n")
          : undefined,
      points: Number(formData.get("points")) || undefined,
      matchId: matchId > 0 ? matchId : undefined,
      lockAt,
    });
  } catch (err) {
    swallowPropErrors(err);
  }
  revalidatePath(`/g/${groupId}/props`);
}

export async function voteAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const { user } = await requireMember(groupId);
  try {
    voteQuestion(getDb(), {
      questionId: String(formData.get("questionId") ?? ""),
      groupId,
      userId: user.id,
      vote: formData.get("vote") === "approve" ? "approve" : "reject",
    });
  } catch (err) {
    swallowPropErrors(err);
  }
  revalidatePath(`/g/${groupId}/props`);
}

export async function answerAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const { user } = await requireMember(groupId);
  try {
    answerQuestion(getDb(), {
      questionId: String(formData.get("questionId") ?? ""),
      groupId,
      userId: user.id,
      value: String(formData.get("value") ?? ""),
    });
  } catch (err) {
    swallowPropErrors(err);
  }
  revalidatePath(`/g/${groupId}/props`);
}

export async function resolveAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const { access } = await requireMember(groupId);
  if (access.role !== "organizer") notFound();
  try {
    resolveQuestion(getDb(), {
      questionId: String(formData.get("questionId") ?? ""),
      groupId,
      correctValue: String(formData.get("correctValue") ?? ""),
      resolutionMode:
        formData.get("resolutionMode") === "closest" ? "closest" : "exact",
    });
  } catch (err) {
    swallowPropErrors(err);
  }
  revalidatePath(`/g/${groupId}/props`);
  revalidatePath(`/g/${groupId}`);
}
