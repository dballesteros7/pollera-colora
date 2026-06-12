// Login-code delivery via Resend's REST API; falls back to console logging
// in development so auth works before the Resend account exists.
import { t, type Locale } from "./i18n";

const FROM = process.env.EMAIL_FROM ?? "Tania de Pollera Colorá <onboarding@resend.dev>";

export async function sendOtpEmail(email: string, code: string, locale: Locale = "es") {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] (dev fallback) login code for ${email}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: t(locale, "mail.subject", { code }),
      text: t(locale, "mail.body", { code }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}

// One-off nudge for members still showing up as "(sin nombre)". We don't know
// their language (no name, rarely a lang cookie on our side), so Tania writes
// in Spanish with English below.
export async function sendNameNudgeEmail(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL ?? "https://pollera-colora.com";
  const subject = "¿Cómo le decimos? — le habla Tania";
  const text = [
    "¡Quiubo! Le habla Tania, desde Bucaramanga.",
    "",
    "Me contaron que usted anda jugando en su polla como “(sin nombre)”, y así el parche no sabe a quién va ganándole. Póngase un nombre, que es un momentico:",
    "",
    `${appUrl}/welcome`,
    "",
    "Y si después se arrepiente, lo cambia cuando quiera en la configuración de su polla.",
    "",
    "Nos vemos en la tabla,",
    "Tania",
    "",
    "—",
    "",
    "(English) Hi! Tania here, from Bucaramanga. Word is you're playing in your polla as “(sin nombre)” — nameless — so your crew can't tell who they're losing to. Pick a name at the link above; it takes a second, and you can change it anytime in your polla's settings.",
  ].join("\n");

  if (!apiKey) {
    console.log(`[email] (dev fallback) name nudge for ${email}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [email], subject, text }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
