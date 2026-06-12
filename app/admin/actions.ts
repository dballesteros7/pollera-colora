"use server";

import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { matches, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { rebuildAllScores } from "@/lib/scoring/score";
import { setOutcome, BONUS_CATEGORIES, type BonusCategory } from "@/lib/bonus";
import { sendNameNudgeEmail } from "@/lib/email";

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
    // hand control back to the API. Reset the result fields too: a lingering
    // FINISHED status would outrank the API's truth and the regression guard
    // would block the refresh forever.
    db.update(matches)
      .set({
        manualOverride: false,
        status: "TIMED",
        regHome: null,
        regAway: null,
        finalHome: null,
        finalAway: null,
        updatedAt: new Date(),
      })
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

export async function nudgeNamelessAction() {
  await requireAdmin();
  const nameless = getDb()
    .select({ email: users.email })
    .from(users)
    .where(isNull(users.displayName))
    .all();
  let sent = 0;
  for (const { email } of nameless) {
    try {
      await sendNameNudgeEmail(email);
      sent++;
    } catch (err) {
      console.error(`[admin] name nudge to ${email} failed:`, err);
    }
  }
  console.log(`[admin] name nudge sent to ${sent}/${nameless.length} users`);
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
