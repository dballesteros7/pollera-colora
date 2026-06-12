"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
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
  const answerType = String(formData.get("answerType")) as AnswerType;
  const matchId = Number(formData.get("matchId"));
  const lockAtRaw = String(formData.get("lockAt") ?? "");
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
      lockAt: lockAtRaw ? new Date(lockAtRaw) : undefined,
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
