"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { getGroupForMember, regenerateInviteCode } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import { getViewerTz, parseDatetimeLocal } from "@/lib/viewer-tz";

async function requireOrganizer(groupId: string) {
  const user = await requireUser(`/g/${groupId}/settings`);
  const access = getGroupForMember(getDb(), user.id, groupId);
  if (!access || access.role !== "organizer") notFound();
  return access.group;
}

export async function regenerateCodeAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  await requireOrganizer(groupId);
  regenerateInviteCode(getDb(), groupId);
  revalidatePath(`/g/${groupId}`);
  revalidatePath(`/g/${groupId}/settings`);
}

export async function updateGroupNameAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  await requireOrganizer(groupId);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return;
  getDb().update(groups).set({ name }).where(eq(groups.id, groupId)).run();
  revalidatePath(`/g/${groupId}`);
  revalidatePath(`/g/${groupId}/settings`);
}

export async function updatePotNoteAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  await requireOrganizer(groupId);
  const potNote = String(formData.get("potNote") ?? "").trim();
  getDb()
    .update(groups)
    .set({ potNote: potNote || null })
    .where(eq(groups.id, groupId))
    .run();
  revalidatePath(`/g/${groupId}`);
  revalidatePath(`/g/${groupId}/settings`);
}

export async function updateBonusLockAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  await requireOrganizer(groupId);
  const raw = String(formData.get("bonusLockAt") ?? "");
  // the bare wall-clock string means the organizer's timezone, not the server's
  const parsed = raw ? parseDatetimeLocal(raw, await getViewerTz()) : null;
  getDb()
    .update(groups)
    .set({ bonusLockAt: parsed && !isNaN(parsed.getTime()) ? parsed : null })
    .where(eq(groups.id, groupId))
    .run();
  revalidatePath(`/g/${groupId}/settings`);
}
