"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export async function setDisplayName(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const name = String(formData.get("displayName") ?? "").trim();
  if (name.length < 2 || name.length > 40) return;
  getDb()
    .update(users)
    .set({ displayName: name })
    .where(eq(users.id, user.id))
    .run();
  revalidatePath("/");
}
