import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import { getAllMatches } from "@/lib/predictions";
import { listRounds, type Round } from "@/lib/recap";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { Header, GroupTabs } from "@/app/components/shell";

const STAGE_KEY: Record<string, string> = {
  LAST_32: "f.r32",
  LAST_16: "f.r16",
  QUARTER_FINALS: "f.qf",
  SEMI_FINALS: "f.sf",
  THIRD_PLACE: "f.third",
  FINAL: "f.final",
};

function roundLabel(lo: Locale, round: Round): string {
  return round.stage === "GROUP_STAGE"
    ? t(lo, "f.matchday", { n: round.matchday ?? "" })
    : t(lo, STAGE_KEY[round.stage] ?? "f.final");
}

export default async function RecapIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}/recap`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, id);
  if (!access) notFound();
  const { group } = access;

  const lo = await getLocale();
  const now = new Date();
  // newest first; only rounds that have actually kicked off
  const started = listRounds(getAllMatches(db), now)
    .filter((r) => r.started)
    .reverse();

  return (
    <>
      <Header />
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "recap.indexTitle")}</h1>
          <p className="pc-hint" style={{ margin: "4px 0 0" }}>{t(lo, "recap.indexSub")}</p>
        </div>

        {started.length === 0 ? (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">🗓️</span>
            <p className="pc-empty__body">{t(lo, "recap.empty")}</p>
          </div>
        ) : (
          <div className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            {started.map((r) => (
              <Link
                key={r.key}
                href={`/g/${group.id}/recap/${r.key}`}
                className="pc-card pc-quicklink"
              >
                <span className="pc-quicklink__text">
                  <span className="pc-quicklink__label">{roundLabel(lo, r)}</span>
                  <span className="pc-quicklink__sub">
                    {r.complete ? t(lo, "recap.statusDone") : t(lo, "recap.statusLive")}
                  </span>
                </span>
                {!r.complete && (
                  <span className="pc-badge pc-badge--live">
                    <span className="pc-dot" />
                    {t(lo, "recap.statusLive")}
                  </span>
                )}
                <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </main>
      <GroupTabs groupId={group.id} active="recap" />
    </>
  );
}
