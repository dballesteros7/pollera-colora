import Link from "next/link";
import Image from "next/image";
import { Trophy, CalendarDays, ListChecks, Star, Sparkles } from "lucide-react";
import { getLocale, t, LOCALES, LOCALE_LABEL } from "@/lib/i18n";
import { recapTabAvailable } from "@/lib/recap";
import { getDb } from "@/lib/db";
import { getAllMatches } from "@/lib/predictions";
import { LangSelect } from "./lang-select";

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
  const tabs: {
    id: string;
    href: string;
    icon: typeof Trophy;
    label: string;
  }[] = [
    { id: "home", href: "", icon: Trophy, label: t(locale, "tab.table") },
    { id: "fixtures", href: "/fixtures", icon: CalendarDays, label: t(locale, "tab.matches") },
    { id: "props", href: "/props", icon: ListChecks, label: t(locale, "tab.recocha") },
    { id: "bonus", href: "/bonus", icon: Star, label: t(locale, "tab.bonus") },
  ];
  // recaps join the bottom bar on Jun 18, once matchday 1 is over
  if (recapTabAvailable(getAllMatches(getDb()))) {
    tabs.push({ id: "recap", href: "/recap", icon: Sparkles, label: t(locale, "tab.recap") });
  }
  return (
    <nav className="pc-tabbar">
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
          </Link>
        );
      })}
    </nav>
  );
}
