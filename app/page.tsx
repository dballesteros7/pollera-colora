import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Plus, LogOut, Crown, Trophy, Sparkles } from "lucide-react";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserGroups } from "@/lib/groups";
import { getSuperPolla } from "@/lib/super-polla";
import { Header, HeroLang } from "@/app/components/shell";
import { getLocale, t } from "@/lib/i18n";
import { logout } from "./login/actions";
import { setDisplayName } from "./actions";

export default async function Home() {
  const user = await getCurrentUser();
  const lo = await getLocale();

  if (!user) {
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
                {t(lo, "landing.sub")}
              </p>
            </div>
          </div>
          <Link href="/login" className="pc-btn pc-btn--primary pc-btn--block pc-btn--lg">
            {t(lo, "landing.cta")}
          </Link>
          <p className="pc-hint" style={{ textAlign: "center", margin: 0 }}>
            {t(lo, "landing.hint")}
          </p>
        </div>
      </main>
    );
  }

  if (!user.displayName) {
    return (
      <main className="pc-hero-shell">
        <div className="pc-tricolor-rule" />
        <HeroLang />
        <div className="pc-hero-shell__center">
          <div className="pc-hero-head">
            <Image src="/emblem.svg" alt="" width={56} height={56} />
            <h1 style={{ margin: 0 }}>{t(lo, "name.title")}</h1>
            <p style={{ color: "var(--ink-soft)", margin: 0 }}>
              {t(lo, "name.q")}
            </p>
          </div>
          <form action={setDisplayName} className="pc-card pc-card--pad-lg pc-flow">
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

  const db = getDb();
  const memberships = getUserGroups(db, user.id);
  // active players (in ≥1 real polla) are auto-enrolled in the Súper Polla;
  // surface it as its own banner above the list
  const superPolla = memberships.length > 0 ? getSuperPolla(db) : null;

  return (
    <>
      <Header>
        <form action={logout}>
          <button type="submit" className="pc-iconbtn" aria-label={t(lo, "a11y.logout")} title={t(lo, "a11y.logout")}>
            <LogOut size={20} aria-hidden />
          </button>
        </form>
      </Header>
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">{t(lo, "home.greeting", { name: user.displayName })}</span>
          <h1 style={{ margin: "2px 0 0" }}>{t(lo, "home.yourPollas")}</h1>
        </div>

        {superPolla && (
          <Link
            href={`/g/${superPolla.id}`}
            className="pc-card pc-quicklink"
            style={{
              borderColor: "var(--magenta)",
              background: "color-mix(in srgb, var(--magenta) 10%, transparent)",
            }}
          >
            <span className="pc-quicklink__icon" style={{ color: "var(--magenta)" }}>
              <Trophy size={24} aria-hidden />
            </span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {t(lo, "super.bannerTitle")}
                <span className="pc-badge pc-badge--open"><Sparkles size={12} aria-hidden />{t(lo, "super.tag")}</span>
              </span>
              <span className="pc-quicklink__sub">{t(lo, "super.bannerSub")}</span>
            </span>
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
        )}

        {memberships.length === 0 ? (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">⚽</span>
            <span className="pc-empty__title">{t(lo, "home.emptyTitle")}</span>
            <p className="pc-empty__body">
              {t(lo, "home.emptyBody")}
            </p>
          </div>
        ) : (
          <div className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            {memberships.map(({ group, role }) => (
              <Link key={group.id} href={`/g/${group.id}`} className="pc-card pc-quicklink">
                <span className="pc-quicklink__icon">
                  {role === "organizer" ? <Crown size={22} aria-hidden /> : <span aria-hidden>⚽</span>}
                </span>
                <span className="pc-quicklink__text">
                  <span className="pc-quicklink__label">{group.name}</span>
                  <span className="pc-quicklink__sub">
                    {role === "organizer" ? t(lo, "home.youOrganize") : t(lo, "home.member")}
                  </span>
                </span>
                <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
              </Link>
            ))}
          </div>
        )}

        <Link href="/g/new" className="pc-btn pc-btn--sticker pc-btn--block">
          <Plus size={18} aria-hidden /> {t(lo, "home.create")}
        </Link>
      </main>
    </>
  );
}
