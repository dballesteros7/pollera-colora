// Tania's quarterfinals nudge: remind every player how the Súper Polla works
// now that the knockouts are getting serious — picks and the comodín are chosen
// in the Súper Polla itself (jokers don't inherit from your polla), plus a
// recap of the remaining rules. Spanish first, English below, like the name
// nudge. Dry-run by default; pass --send to actually deliver.
// Usage: tsx scripts/send-super-reminder.ts [--send]
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { users } from "../lib/db/schema";

const SEND = process.argv.includes("--send");
const FROM = process.env.EMAIL_FROM ?? "Tania de Pollera Colorá <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "https://pollera-colora.com";

const SUBJECT = "Cuartos de final: no deje su comodín tirado — le habla Tania";

const BODY = [
  "¡Quiubo! Le habla Tania, desde Bucaramanga.",
  "",
  "Esta noche arrancan los cuartos de final, y en la Súper Polla se juega la gloria total. Antes de que pite el árbitro, repasemos las reglas — que me contaron que a más de uno se le está quedando el comodín en el bolsillo:",
  "",
  "• La Súper Polla tiene sus propios pronósticos: entre y marque los suyos. Si no marca, usamos los de sus pollas de siempre como cortesía (ahora de cualquiera de sus pollas, no solo la primera).",
  "• El comodín NO se hereda de su polla: se activa en la Súper Polla, en el pronóstico del partido que usted elija. Uno por ronda, dobla los puntos de ese partido.",
  "• Quedan 4 comodines por jugar: cuartos, semifinales, tercer puesto y final. No los deje vencer.",
  "• Se puntúa Marcador o nada: 4 pts por acertar el resultado, 10 por el marcador exacto (en los 90 minutos). Cuartos y semis multiplican ×2, la final ×3 — con comodín, eso se dobla otra vez.",
  "• Los pronósticos de campeón, goleador y demás ya cerraron; los partidos se revelan con el pitazo inicial, con su detalle de puntos.",
  "",
  `Su comodín lo espera aquí: ${APP_URL}`,
  "",
  "Nos vemos en la tabla,",
  "Tania",
  "",
  "—",
  "",
  "(English) Hi! Tania here, from Bucaramanga. The quarterfinals kick off tonight, and the Súper Polla plays for ultimate glory. Quick rules recap: the Súper Polla has its own picks — go make yours; if you don't, we fall back to your regular pollas' picks as a courtesy (now from any of your pollas, not just the first). The comodín is NOT inherited from your polla: you switch it on in the Súper Polla, on the match you choose — one per round, it doubles that match. Four comodines are still in play: quarters, semis, third place, and the final. Scoring is Marcador o nada: 4 pts for the right result, 10 for the exact score (in 90 minutes); quarters and semis count ×2, the final ×3 — a comodín doubles that again. Champion/top-scorer picks are closed, and everyone's picks are revealed at kickoff. Your comodín is waiting at the link above.",
].join("\n");

async function main() {
  const db = getDb();
  const recipients = db
    .select({ email: users.email, name: users.displayName })
    .from(users)
    .where(eq(users.isBot, false))
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
