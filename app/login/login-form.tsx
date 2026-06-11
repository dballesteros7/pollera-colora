"use client";

import { useActionState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { sendCode, checkCode, type LoginState } from "./actions";

const initial: LoginState = { step: "email" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    async (prev: LoginState, formData: FormData) =>
      prev.step === "email" ? sendCode(prev, formData) : checkCode(prev, formData),
    initial,
  );

  if (state.step === "email") {
    return (
      <form action={formAction} className="pc-card pc-card--pad-lg pc-flow">
        <div className="pc-field">
          <label className="pc-label" htmlFor="login-email">
            Tu correo
          </label>
          <input
            id="login-email"
            className="pc-input"
            type="email"
            name="email"
            placeholder="nombre@correo.com"
            required
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="pc-btn pc-btn--primary pc-btn--block"
          disabled={pending}
        >
          {pending ? "Enviando…" : "Mandar código"}
          {!pending && <ArrowRight size={18} aria-hidden />}
        </button>
        {state.error && (
          <p role="alert" className="pc-hint" style={{ color: "var(--danger)", textAlign: "center", margin: 0 }}>
            {state.error}
          </p>
        )}
        <p className="pc-hint" style={{ textAlign: "center", margin: 0 }}>
          Te llega un código de 6 dígitos. Sin contraseñas.
        </p>
      </form>
    );
  }

  return (
    <form action={formAction} className="pc-card pc-card--pad-lg pc-flow">
      <p className="pc-hint" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowLeft size={14} aria-hidden /> Código enviado a{" "}
        <strong>{state.email}</strong>
      </p>
      <input type="hidden" name="next" value={next ?? "/"} />
      <div className="pc-field">
        <label className="pc-label" htmlFor="login-code">
          Código
        </label>
        <input
          id="login-code"
          className="pc-input pc-input--code"
          type="text"
          name="code"
          placeholder="••••••"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
        />
        <span className="pc-hint">Te lo mandamos al correo</span>
      </div>
      <button
        type="submit"
        className="pc-btn pc-btn--primary pc-btn--block"
        disabled={pending}
      >
        {pending ? "Verificando…" : "Entrar"}
      </button>
      {state.error && (
        <p role="alert" className="pc-hint" style={{ color: "var(--danger)", textAlign: "center", margin: 0 }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
