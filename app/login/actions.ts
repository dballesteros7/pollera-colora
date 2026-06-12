"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requestOtp, verifyOtp, OtpRateLimitError } from "@/lib/auth/otp";
import { createSessionForEmail, destroySession } from "@/lib/auth/session";
import { getLocale, t } from "@/lib/i18n";

export interface LoginState {
  step: "email" | "code";
  email?: string;
  error?: string;
}

// per-IP throttle on top of the per-email limit: each real send costs Resend
// quota, so an attacker iterating addresses must not get unlimited sends.
// In-memory is fine — single machine, and a restart resetting it is harmless.
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX_SENDS = 10;
const ipSends = new Map<string, number[]>();

function ipThrottled(ip: string, now: number): boolean {
  const recent = (ipSends.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_MAX_SENDS) {
    ipSends.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipSends.set(ip, recent);
  if (ipSends.size > 10_000) ipSends.clear(); // memory backstop
  return false;
}

export async function sendCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const lo = await getLocale();
  const email = String(formData.get("email") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return { step: "email", error: t(lo, "err.email") };
  }
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (ipThrottled(ip, Date.now())) {
    return { step: "email", error: t(lo, "err.rate") };
  }
  try {
    const { email: normalized } = await requestOtp(getDb(), email, new Date(), lo);
    return { step: "code", email: normalized };
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return { step: "email", error: t(lo, "err.rate") };
    }
    console.error("[auth] sending code failed:", err);
    return { step: "email", error: t(lo, "err.send") };
  }
}

export async function checkCode(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const lo = await getLocale();
  const email = prev.email ?? String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  const result = verifyOtp(getDb(), email, code);
  if (!result.ok) {
    return {
      step: "code",
      email,
      error: result.reason === "expired" ? t(lo, "err.expired") : t(lo, "err.wrongCode"),
    };
  }
  await createSessionForEmail(result.email);
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
