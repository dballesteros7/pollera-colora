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
