// Login-code delivery via Resend's REST API; falls back to console logging
// in development so auth works before the Resend account exists.

const FROM = process.env.EMAIL_FROM ?? "Pollera Colora <onboarding@resend.dev>";

export async function sendOtpEmail(email: string, code: string) {
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
      subject: `${code} es tu código — Pollera Colora`,
      text: `Tu código de ingreso es: ${code}\n\nVence en 10 minutos. Si no lo pediste, ignora este correo.`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
