import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale, t } from "@/lib/i18n";
import { HeroLang } from "@/app/components/shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  const lo = await getLocale();

  return (
    <main className="pc-hero-shell">
      <div className="pc-tricolor-rule" />
      <HeroLang />
      <div className="pc-hero-shell__center">
        <div className="pc-hero-head">
          <Image src="/emblem.svg" alt="Pollera Colorá" width={76} height={76} />
          <div>
            <h1 style={{ margin: 0 }}>
              {t(lo, "hero.title1")}
              <br />
              {t(lo, "hero.title2")}
            </h1>
            <p style={{ color: "var(--ink-soft)", margin: "8px 0 0" }}>
              {t(lo, "login.sub")}
            </p>
          </div>
        </div>
        <LoginForm
          next={next}
          labels={{
            email: t(lo, "login.email"),
            emailPh: t(lo, "login.emailPh"),
            send: t(lo, "login.send"),
            sending: t(lo, "login.sending"),
            codeInfo: t(lo, "login.codeInfo"),
            sentTo: t(lo, "login.sentTo"),
            code: t(lo, "login.code"),
            codeMailed: t(lo, "login.codeMailed"),
            enter: t(lo, "login.enter"),
            verifying: t(lo, "login.verifying"),
          }}
        />
      </div>
    </main>
  );
}
