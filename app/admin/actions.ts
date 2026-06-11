"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { rebuildAllScores } from "@/lib/scoring/score";
import { setOutcome, BONUS_CATEGORIES, type BonusCategory } from "@/lib/bonus";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  return user;
}

export async function overrideMatchAction(formData: FormData) {
  await requireAdmin();
  const db = getDb();
  const id = Number(formData.get("matchId"));
  const clear = formData.get("clear") === "on";

  if (clear) {
    // hand control back to the API; next sync refreshes the row
    db.update(matches)
      .set({ manualOverride: false, updatedAt: new Date() })
      .where(eq(matches.id, id))
      .run();
  } else {
    const regHome = Number(formData.get("regHome"));
    const regAway = Number(formData.get("regAway"));
    if (!Number.isInteger(regHome) || !Number.isInteger(regAway)) return;
    db.update(matches)
      .set({
        manualOverride: true,
        status: "FINISHED",
        regHome,
        regAway,
        finalHome: Number(formData.get("finalHome")) || regHome,
        finalAway: Number(formData.get("finalAway")) || regAway,
        updatedAt: new Date(),
      })
      .where(eq(matches.id, id))
      .run();
  }
  rebuildAllScores(db);
  revalidatePath("/admin");
}

export async function setOutcomesAction(formData: FormData) {
  await requireAdmin();
  const db = getDb();
  for (const cat of BONUS_CATEGORIES) {
    const value = formData.get(`outcome_${cat.id}`);
    if (value === null) continue;
    setOutcome(db, cat.id as BonusCategory, String(value));
  }
  rebuildAllScores(db);
  revalidatePath("/admin");
}
