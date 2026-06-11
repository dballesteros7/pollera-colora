"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { createGroup } from "@/lib/groups";
import { parseScoringRules } from "@/lib/scoring/presets";
import { requireUser } from "@/lib/auth/require";

export async function createGroupAction(formData: FormData) {
  const user = await requireUser("/g/new");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) return;

  const rules = parseScoringRules({
    preset: formData.get("preset"),
    unicoAcertado: formData.get("unicoAcertado") === "on",
  });
  const potNote = String(formData.get("potNote") ?? "").trim();

  const group = createGroup(getDb(), user.id, {
    name,
    scoringRules: rules,
    potNote,
  });
  redirect(`/g/${group.id}`);
}
