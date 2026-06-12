import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale, t } from "@/lib/i18n";
import { HeroLang } from "@/app/components/shell";
import { setDisplayName } from "@/app/actions";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);
  if (user.displayName) redirect(target);
  const lo = await getLocale();

  return (
    <main className="pc-hero-shell">
      <div className="pc-tricolor-rule" />
      <HeroLang />
      <div className="pc-hero-shell__center">
        <div className="pc-hero-head">
          <Image src="/emblem.svg" alt="" width={56} height={56} />
          <h1 style={{ margin: 0 }}>{t(lo, "name.title")}</h1>
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t(lo, "name.q")}</p>
        </div>
        <form action={setDisplayName} className="pc-card pc-card--pad-lg pc-flow">
          <input type="hidden" name="next" value={target} />
          <div className="pc-field">
            <label className="pc-label" htmlFor="displayName">
              {t(lo, "name.label")}
            </label>
            <input
              id="displayName"
              className="pc-input"
              name="displayName"
              placeholder={t(lo, "name.placeholder")}
              required
              minLength={2}
              maxLength={40}
              autoFocus
            />
          </div>
          <button type="submit" className="pc-btn pc-btn--primary pc-btn--block">
            {t(lo, "name.done")}
          </button>
        </form>
      </div>
    </main>
  );
}
