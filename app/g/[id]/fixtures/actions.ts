"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  savePrediction,
  PredictionLockedError,
  MatchNotPredictableError,
} from "@/lib/predictions";
import { parseScoringRules, PRESETS } from "@/lib/scoring/presets";

export async function savePredictionAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireUser(`/g/${groupId}/fixtures`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, groupId);
  if (!access) notFound();

  const rules = parseScoringRules(access.group.scoringRules);
  try {
    savePrediction(db, {
      userId: user.id,
      groupId,
      matchId: Number(formData.get("matchId")),
      predHome: Number(formData.get("predHome")),
      predAway: Number(formData.get("predAway")),
      joker: formData.get("joker") === "on",
      allowJoker: PRESETS[rules.preset].joker,
    });
  } catch (err) {
    if (
      err instanceof PredictionLockedError ||
      err instanceof MatchNotPredictableError
    ) {
      // form re-renders against current state; the lock shows itself
      revalidatePath(`/g/${groupId}/fixtures`);
      return;
    }
    throw err;
  }
  revalidatePath(`/g/${groupId}/fixtures`);
}
