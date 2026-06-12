"use server";

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

export async function sendCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const lo = await getLocale();
  const email = String(formData.get("email") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return { step: "email", error: t(lo, "err.email") };
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
  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
