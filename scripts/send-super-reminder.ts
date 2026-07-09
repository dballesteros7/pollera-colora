// Tania's quarterfinals nudge: remind every player how the Súper Polla works
// now that the knockouts are getting serious — picks and the comodín are chosen
// in the Súper Polla itself (jokers don't inherit from your polla), plus a
// recap of the remaining rules. Spanish first, English below, like the name
// nudge. Dry-run by default; pass --send to actually deliver.
// Usage: tsx scripts/send-super-reminder.ts [--send]
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { memberships, users } from "../lib/db/schema";
import { getSuperPolla } from "../lib/super-polla";

const SEND = process.argv.includes("--send");
const FROM = process.env.EMAIL_FROM ?? "Tania de Pollera Colorá <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "https://pollera-colora.com";

const SUBJECT = "Quarterfinals tonight: don't leave your comodín in your pocket — Tania";

const BODY = [
  "¡Quiubo! Tania here, reporting live from Bucaramanga.",
  "",
  "The quarterfinals kick off tonight, and in the Súper Polla we're playing for la gloria total. Before the ref blows the whistle, a quick word — because rumor has it more than one of you has been leaving your comodín in your pocket:",
  "",
  "• The Súper Polla has its own picks. Go in and make yours. If you don't, we'll borrow the ones from your regular pollas as a courtesy (any of your pollas now, not just the first one you joined) — but where's the fun in that?",
  "• The comodín does NOT tag along from your polla. You play it in the Súper Polla itself, on whichever match you fancy. One per round, and it doubles that match's points.",
  "• Forgot it? Tranquilo. We'll drop it on the last match you picked in the round. But picking it yourself is half the sabor.",
  "• Four comodines are still on the table: quarterfinals, semis, the third-place match, and the final. Yes, the third-place match gets its own. Don't say Tania never told you.",
  "• Scoring is Marcador o nada: 4 points for calling the result, 10 for the exact score. Quarters and semis count double, the final counts triple — and a comodín doubles all of that again. Do the math and fan yourself.",
  "• And óigame bien: only the 90 minutes count. Whatever happens in extra time or penalties is drama for the TV, not for the score sheet — a 1-1 that ends 2-1 in extra time is still 1-1 for your pick.",
  "• Champion, goleador and the other big calls are locked. Everyone's picks go public at kickoff, with the points spelled out match by match.",
  "",
  `Your comodín is waiting for you here: ${APP_URL}`,
  "",
  "See you at the top of the table (well, one of us),",
  "Tania",
].join("\n");

async function main() {
  const db = getDb();
  const sp = getSuperPolla(db);
  if (!sp) throw new Error("No Súper Polla in this DB");
  // only actual players: Súper Polla members (auto-enrolled from real pollas)
  const recipients = db
    .select({ email: users.email, name: users.displayName })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.groupId, sp.id), eq(users.isBot, false)))
    .all()
    .filter((u) => u.email.includes("@"));

  console.log(`${SEND ? "SENDING" : "DRY RUN"} — ${recipients.length} recipients`);
  console.log(`Subject: ${SUBJECT}\n\n${BODY}\n`);
  for (const r of recipients) console.log(` -> ${r.name ?? "(sin nombre)"} <${r.email}>`);
  if (!SEND) {
    console.log("\n(dry run — pass --send to deliver)");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  for (const r of recipients) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [r.email], subject: SUBJECT, text: BODY }),
    });
    if (!res.ok) {
      console.error(`FAILED ${r.email}: ${res.status} ${await res.text()}`);
    } else {
      console.log(`sent ${r.email}`);
    }
    // Resend allows 2 req/s — stay well under it
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
