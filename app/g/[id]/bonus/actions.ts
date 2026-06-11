"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  BONUS_CATEGORIES,
  saveBonusPick,
  BonusLockedError,
  type BonusCategory,
} from "@/lib/bonus";

export async function saveBonusPicksAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireUser(`/g/${groupId}/bonus`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, groupId);
  if (!access) notFound();

  try {
    for (const cat of BONUS_CATEGORIES) {
      const value = formData.get(`pick_${cat.id}`);
      if (value === null) continue;
      saveBonusPick(db, {
        userId: user.id,
        groupId,
        category: cat.id as BonusCategory,
        value: String(value),
      });
    }
  } catch (err) {
    if (!(err instanceof BonusLockedError)) throw err;
  }
  revalidatePath(`/g/${groupId}/bonus`);
}
