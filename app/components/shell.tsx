import Link from "next/link";
import Image from "next/image";
import { Trophy, CalendarDays, ListChecks, Star } from "lucide-react";
import { getLocale, t, LOCALES } from "@/lib/i18n";

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
    <span className="pc-lang">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={`/api/lang?l=${l}`}
          aria-current={l === locale ? "true" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
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
  active: "home" | "fixtures" | "props" | "bonus";
}) {
  const locale = await getLocale();
  const tabs = [
    { id: "home", href: "", icon: Trophy, label: t(locale, "tab.table") },
    { id: "fixtures", href: "/fixtures", icon: CalendarDays, label: t(locale, "tab.matches") },
    { id: "props", href: "/props", icon: ListChecks, label: t(locale, "tab.recocha") },
    { id: "bonus", href: "/bonus", icon: Star, label: t(locale, "tab.bonus") },
  ] as const;
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
