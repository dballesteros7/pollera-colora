"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { getGroupForMember, regenerateInviteCode } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";

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
  const parsed = raw ? new Date(raw) : null;
  getDb()
    .update(groups)
    .set({ bonusLockAt: parsed && !isNaN(parsed.getTime()) ? parsed : null })
    .where(eq(groups.id, groupId))
    .run();
  revalidatePath(`/g/${groupId}/settings`);
}
