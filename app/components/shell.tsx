import Link from "next/link";
import Image from "next/image";
import { Trophy, CalendarDays, ListChecks, Star } from "lucide-react";

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

export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <header className="pc-header">
        <Brand />
        <span className="pc-header__spacer" />
        {children}
      </header>
      <div className="pc-tricolor-rule" />
    </>
  );
}

const TABS = [
  { href: "", icon: Trophy, label: "Tabla" },
  { href: "/fixtures", icon: CalendarDays, label: "Partidos" },
  { href: "/props", icon: ListChecks, label: "Preguntas" },
  { href: "/bonus", icon: Star, label: "Bonus" },
] as const;

// sticky bottom tab bar for group pages
export function GroupTabs({
  groupId,
  active,
}: {
  groupId: string;
  active: "home" | "fixtures" | "props" | "bonus";
}) {
  return (
    <nav className="pc-tabbar">
      {TABS.map((t) => {
        const id = t.href === "" ? "home" : t.href.slice(1);
        const Icon = t.icon;
        return (
          <Link
            key={t.label}
            href={`/g/${groupId}${t.href}`}
            className="pc-tabbar__tab"
            aria-current={active === id ? "page" : undefined}
          >
            <Icon size={22} aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
