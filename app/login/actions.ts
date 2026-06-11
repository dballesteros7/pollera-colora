"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requestOtp, verifyOtp, OtpRateLimitError } from "@/lib/auth/otp";
import { createSessionForEmail, destroySession } from "@/lib/auth/session";

export interface LoginState {
  step: "email" | "code";
  email?: string;
  error?: string;
}

export async function sendCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return { step: "email", error: "Ingrese un correo válido." };
  }
  try {
    const { email: normalized } = await requestOtp(getDb(), email);
    return { step: "code", email: normalized };
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return {
        step: "email",
        error: "Demasiados códigos pedidos. Espere unos minutos.",
      };
    }
    console.error("[auth] sending code failed:", err);
    return {
      step: "email",
      error: "No pudimos mandar el código. Intente de nuevo.",
    };
  }
}

export async function checkCode(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = prev.email ?? String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  const result = verifyOtp(getDb(), email, code);
  if (!result.ok) {
    return {
      step: "code",
      email,
      error:
        result.reason === "expired"
          ? "El código venció. Pida uno nuevo."
          : "Código incorrecto.",
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
