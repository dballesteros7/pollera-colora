"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  BONUS_CATEGORIES,
  saveBonusPick,
  bonusLocked,
  BonusLockedError,
  type BonusCategory,
} from "@/lib/bonus";
import {
  effectiveSuperBonusByUser,
  regularPollaIdsOf,
} from "@/lib/super-polla";

export async function saveBonusPicksAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireUser(`/g/${groupId}/bonus`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, groupId);
  if (!access) notFound();

  // after the deadline the Superpolla still takes first-time picks: only
  // categories with no effective value anywhere for this player qualify
  // (saveBonusPick enforces the late-fill close and insert-only semantics)
  let lateFillable: Set<string> | null = null;
  if (access.group.isSuper && bonusLocked(access.group)) {
    const eff = effectiveSuperBonusByUser(db).get(user.id);
    lateFillable = new Set(
      BONUS_CATEGORIES.filter((c) => !eff?.get(c.id)?.value).map((c) => c.id),
    );
  }

  try {
    for (const cat of BONUS_CATEGORIES) {
      const value = formData.get(`pick_${cat.id}`);
      if (value === null) continue;
      if (lateFillable && (!lateFillable.has(cat.id) || !String(value).trim())) {
        continue; // never touch existing bets past the deadline
      }
      // a late fill lands everywhere the player plays: the Superpolla and
      // each of their regular pollas (a fillable category is empty in all of
      // them, and inserts never overwrite anything anyway)
      const targets = lateFillable
        ? [groupId, ...regularPollaIdsOf(db, user.id)]
        : [groupId];
      for (const target of targets) {
        saveBonusPick(db, {
          userId: user.id,
          groupId: target,
          category: cat.id as BonusCategory,
          value: String(value),
          lateFill: lateFillable !== null,
        });
      }
    }
  } catch (err) {
    if (!(err instanceof BonusLockedError)) throw err;
    revalidatePath(`/g/${groupId}/bonus`);
    revalidatePath(`/g/${groupId}`);
    return { err: true };
  }
  revalidatePath(`/g/${groupId}/bonus`);
  // the Superpolla renders bonus inline on its home page
  revalidatePath(`/g/${groupId}`);
  return {};
}
