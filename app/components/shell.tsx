import Link from "next/link";
import Image from "next/image";
import { Trophy, CalendarDays, ListChecks, Star, Sparkles } from "lucide-react";
import { getLocale, t, LOCALES, LOCALE_LABEL } from "@/lib/i18n";
import { recapTabAvailable } from "@/lib/recap";
import { RECOCHA_CLOSE } from "@/lib/props";
import { BONUS_CLOSE } from "@/lib/bonus";
import { getDb } from "@/lib/db";
import { getAllMatches } from "@/lib/predictions";
import { LangSelect } from "./lang-select";

// compact time-left for the tab sub-label: "1d 5h" / "5h 20m" / "20m"
function tabCountdown(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function Brand() {
  return (
    <Link href="/" className="pc-header__brand">
      <Image src="/emblem.svg" alt="" width={30} height={30} />
      <span>
        Pollera <span style={{ color: "var(--magenta)" }}>Colorá</span>
      </span>
    </Link>
  );
}

async function LangSwitcher() {
  const locale = await getLocale();
  return (
    <LangSelect
      current={locale}
      ariaLabel={t(locale, "a11y.language")}
      options={LOCALES.map((l) => ({ code: l, label: LOCALE_LABEL[l] }))}
    />
  );
}

// floating switcher for header-less hero pages (login/join)
export async function HeroLang() {
  const locale = await getLocale();
  return (
    <span className="pc-hero-lang">
      <LangSelect
        current={locale}
        ariaLabel={t(locale, "a11y.language")}
        options={LOCALES.map((l) => ({ code: l, label: LOCALE_LABEL[l] }))}
      />
    </span>
  );
}

export async function Header({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <header className="pc-header">
        <Brand />
        <span className="pc-header__spacer" />
        <LangSwitcher />
        {children}
      </header>
      <div className="pc-tricolor-rule" />
    </>
  );
}

// sticky bottom tab bar for group pages
export async function GroupTabs({
  groupId,
  active,
}: {
  groupId: string;
  active: "home" | "fixtures" | "props" | "bonus" | "recap";
}) {
  const locale = await getLocale();
  // countdowns shown under their tabs while still open: the Recocha weekend
  // close, and the bonus close at the end of the group phase
  const recochaMsLeft = RECOCHA_CLOSE.getTime() - Date.now();
  const bonusMsLeft = BONUS_CLOSE.getTime() - Date.now();
  const tabs: {
    id: string;
    href: string;
    icon: typeof Trophy;
    label: string;
    sub?: string;
  }[] = [
    { id: "home", href: "", icon: Trophy, label: t(locale, "tab.table") },
    { id: "fixtures", href: "/fixtures", icon: CalendarDays, label: t(locale, "tab.matches") },
    {
      id: "props",
      href: "/props",
      icon: ListChecks,
      label: t(locale, "tab.recocha"),
      sub: recochaMsLeft > 0 ? tabCountdown(recochaMsLeft) : undefined,
    },
    {
      id: "bonus",
      href: "/bonus",
      icon: Star,
      label: t(locale, "tab.bonus"),
      sub: bonusMsLeft > 0 ? tabCountdown(bonusMsLeft) : undefined,
    },
  ];
  // recaps join the bottom bar on Jun 18, once matchday 1 is over
  if (recapTabAvailable(getAllMatches(getDb()))) {
    tabs.push({ id: "recap", href: "/recap", icon: Sparkles, label: t(locale, "tab.recap") });
  }
  return (
    <nav
      className="pc-tabbar"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={`/g/${groupId}${tab.href}`}
            className="pc-tabbar__tab"
            aria-current={active === tab.id ? "page" : undefined}
          >
            <Icon size={22} aria-hidden />
            {tab.label}
            {tab.sub && <span className="pc-tabbar__sub">{tab.sub}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

// Site-wide attribution footer — football-data.org's free tier asks for a
// visible credit. Rendered once in the root layout, after every page.
export async function Attribution() {
  const locale = await getLocale();
  return (
    <footer className="pc-credit">
      <a
        href="https://www.football-data.org"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t(locale, "footer.fdAttribution")}
      </a>
    </footer>
  );
}
