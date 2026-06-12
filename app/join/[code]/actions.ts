"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupByInviteCode, joinGroup } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";

export async function joinGroupAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const user = await requireUser(`/join/${code}?go=1`);
  const group = getGroupByInviteCode(getDb(), code);
  if (!group) redirect("/");
  joinGroup(getDb(), user.id, group.id);
  redirect(`/g/${group.id}`);
}
