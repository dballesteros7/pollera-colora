"use client";

import { useActionState } from "react";
import { sendCode, checkCode, type LoginState } from "./actions";

const initial: LoginState = { step: "email" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    async (prev: LoginState, formData: FormData) =>
      prev.step === "email" ? sendCode(prev, formData) : checkCode(prev, formData),
    initial,
  );

  // Unstyled on purpose — design system pending.
  if (state.step === "email") {
    return (
      <form action={formAction}>
        <label>
          Tu correo
          <input type="email" name="email" required autoFocus />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviarme un código"}
        </button>
        {state.error && <p role="alert">{state.error}</p>}
      </form>
    );
  }

  return (
    <form action={formAction}>
      <p>
        Te enviamos un código de 6 dígitos a <strong>{state.email}</strong>.
      </p>
      <input type="hidden" name="next" value={next ?? "/"} />
      <label>
        Código
        <input
          type="text"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Verificando…" : "Entrar"}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
