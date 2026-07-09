// Tania's bonus-picks amnesty note: players who never made some (or any) of
// the tournament bonus picks — champion, top scorer, … — get a personalized
// nudge that the door is open for first-time picks until the late-fill close.
// Recipients are computed live (anyone with a gap), minus the EXCLUDE list.
// Dry-run by default; pass --send to actually deliver.
// Usage: tsx scripts/send-bonus-late-fill.ts [--send]
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { memberships, users } from "../lib/db/schema";
import { BONUS_CATEGORIES } from "../lib/bonus";
import { effectiveSuperBonusByUser, getSuperPolla } from "../lib/super-polla";

const SEND = process.argv.includes("--send");
const FROM = process.env.EMAIL_FROM ?? "Tania de Pollera Colorá <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "https://pollera-colora.com";

// inactive players we don't nudge
const EXCLUDE = new Set(["duyguk94@gmail.com"]);

const LABEL: Record<string, string> = {
  champion: "Champion",
  runner_up: "Runner-up",
  third: "Third place",
  top_scorer: "Top scorer (el goleador)",
  best_gk: "Best goalkeeper",
};

const SUBJECT = "Your polla has holes in it — Tania with a one-time offer";

function body(missing: string[]): string {
  const list = missing.map((c) => `  • ${LABEL[c]}`).join("\n");
  return [
    "¡Quiubo! Tania again, still in Bucaramanga, still watching the table.",
    "",
    "Doing my rounds before the semis I noticed your slate is missing some of the big tournament calls — you never picked:",
    "",
    list,
    "",
    "Normally these closed on July 3 and Tania forgives nothing. But since several of you were in the same boat, we're leaving the door open un momentico: you can add the ones you're missing — first time only, existing picks don't move — until Monday night (July 13). They'll count in the Superpolla AND in your pollas.",
    "",
    `Fill the holes here, under "Tournament picks": ${APP_URL}`,
    "",
    "Champion is worth 10 points, the others 6 to 8. In a table this tight, that's not decoration — that's the difference between glory and doing the dishes.",
    "",
    "Don't leave it for Monday 9:59pm,",
    "Tania",
  ].join("\n");
}

async function main() {
  const db = getDb();
  const sp = getSuperPolla(db);
  if (!sp) throw new Error("No Superpolla in this DB");

  const members = db
    .select({ email: users.email, name: users.displayName, id: users.id })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.groupId, sp.id), eq(users.isBot, false)))
    .all()
    .filter((u) => u.email.includes("@") && !EXCLUDE.has(u.email));

  const effBonus = effectiveSuperBonusByUser(db);
  const targets = members
    .map((u) => ({
      ...u,
      missing: BONUS_CATEGORIES.filter(
        (c) => !effBonus.get(u.id)?.get(c.id)?.value,
      ).map((c) => c.id),
    }))
    .filter((u) => u.missing.length > 0);

  console.log(`${SEND ? "SENDING" : "DRY RUN"} — ${targets.length} recipients`);
  for (const r of targets) {
    console.log(`\n=== ${r.name ?? "(sin nombre)"} <${r.email}> — missing: ${r.missing.join(", ")}`);
    if (!SEND) continue;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [r.email],
        subject: SUBJECT,
        text: body(r.missing),
      }),
    });
    if (!res.ok) {
      console.error(`FAILED ${r.email}: ${res.status} ${await res.text()}`);
    } else {
      console.log(`sent ${r.email}`);
    }
    // Resend allows 2 req/s — stay well under it
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  if (!SEND) console.log(`\nSample body:\n\n${body(["champion", "best_gk"])}\n\n(dry run — pass --send to deliver)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
