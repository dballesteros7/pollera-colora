"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/require";
import { getGroupForMember } from "@/lib/groups";
import { setSuperIdentity } from "@/lib/super-polla";

// First-open choice on the Súper Polla: keep your real name, or pick a nickname
// that everyone sees. Until this is set, strangers see a famous-footballer alias.
export async function setSuperIdentityAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireUser(`/g/${groupId}`);
  const db = getDb();

  const access = getGroupForMember(db, user.id, groupId);
  if (!access || !access.group.isSuper) return;

  const mode = String(formData.get("mode") ?? "");
  if (mode !== "real" && mode !== "nickname") return;

  const nickname = String(formData.get("nickname") ?? "").trim();
  if (mode === "nickname" && (nickname.length < 2 || nickname.length > 40)) return;

  setSuperIdentity(db, user.id, mode, mode === "nickname" ? nickname : null);
  revalidatePath(`/g/${groupId}`);
}
