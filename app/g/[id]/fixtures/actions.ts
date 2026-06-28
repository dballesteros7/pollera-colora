"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  savePrediction,
  savePredictionForGroups,
  copyPredictions,
  PredictionLockedError,
  MatchNotPredictableError,
} from "@/lib/predictions";
import { getUserGroups } from "@/lib/groups";
import { parseScoringRules, PRESETS, presetForGroup } from "@/lib/scoring/presets";

export async function savePredictionAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireUser(`/g/${groupId}/fixtures`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, groupId);
  if (!access) notFound();

  const applyAll = formData.get("allGroups") === "on";
  try {
    if (applyAll) {
      // score goes to every polla; the joker stays in this one
      const groups = getUserGroups(db, user.id).map(({ group }) => {
        const r = parseScoringRules(group.scoringRules);
        const isOrigin = group.id === groupId;
        return {
          groupId: group.id,
          joker: isOrigin && formData.get("joker") === "on",
          allowJoker: isOrigin && PRESETS[r.preset].joker,
          // the joker checkbox only speaks for this polla — never clear
          // a joker the user set in another one
          preserveJoker: !isOrigin,
        };
      });
      savePredictionForGroups(db, {
        userId: user.id,
        matchId: Number(formData.get("matchId")),
        predHome: Number(formData.get("predHome")),
        predAway: Number(formData.get("predAway")),
        groups,
      });
    } else {
      savePrediction(db, {
        userId: user.id,
        groupId,
        matchId: Number(formData.get("matchId")),
        predHome: Number(formData.get("predHome")),
        predAway: Number(formData.get("predAway")),
        joker: formData.get("joker") === "on",
        allowJoker: presetForGroup(access.group).joker,
      });
    }
  } catch (err) {
    if (
      err instanceof PredictionLockedError ||
      err instanceof MatchNotPredictableError
    ) {
      // form re-renders against current state; the lock shows itself
      revalidatePath(`/g/${groupId}/fixtures`);
      revalidatePath(`/g/${groupId}`);
      // an invalid score (e.g. the 1776–0 Easter egg, over the 99 cap) gets a
      // distinct toast — "locked" would be the wrong story
      return { err: true, invalid: err instanceof MatchNotPredictableError };
    }
    throw err;
  }
  revalidatePath(`/g/${groupId}/fixtures`);
  revalidatePath(`/g/${groupId}`);
  return {};
}

export async function copyPredictionsAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireUser(`/g/${groupId}/fixtures`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, groupId);
  if (!access) notFound();
  const fromGroupId = String(formData.get("fromGroupId") ?? "");
  // source must also be one of the user's own groups
  const fromAccess = getGroupForMember(db, user.id, fromGroupId);
  if (!fromAccess || fromGroupId === groupId) return { err: true };
  const copied = copyPredictions(db, { userId: user.id, fromGroupId, toGroupId: groupId });
  revalidatePath(`/g/${groupId}/fixtures`);
  revalidatePath(`/g/${groupId}`);
  return { copied };
}
