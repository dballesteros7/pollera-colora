import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Trophy, Target, Sparkles, ChevronLeft, Users } from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import { getAllMatches } from "@/lib/predictions";
import {
  getRound,
  getRoundRecapForUser,
  getGlobalRoundStanding,
  getPredictionBuddy,
  type Round,
  type GlobalEntry,
} from "@/lib/recap";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { teamName } from "@/lib/teams";
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

function AliasMark({ lo }: { lo: Locale }) {
  return (
    <span
      className="pc-player__alias"
      title={t(lo, "recap.aliasHint")}
      aria-label={t(lo, "recap.aliasHint")}
    >
      🎭
    </span>
  );
}

function GlobalRow({ e, lo }: { e: GlobalEntry; lo: Locale }) {
  const aliased = !e.displayName && !!e.alias;
  return (
    <tr className={e.isMe ? "is-you" : undefined}>
      <td>
        {e.rank <= 3 ? (
          <span className={`pc-medal pc-medal--${e.rank}`}>{e.rank}</span>
        ) : (
          <span className="pc-rank">{e.rank}</span>
        )}
      </td>
      <td>
        <span className="pc-player">
          <span
            className="pc-player__name"
            style={aliased ? { fontStyle: "italic" } : undefined}
          >
            {e.displayName ?? e.alias ?? "—"}
          </span>
          {e.isBot && (
            <Bot
              size={15}
              style={{ flex: "none", color: "var(--ink-soft)" }}
              aria-label={t(lo, "recap.botTag")}
            />
          )}
          {aliased && <AliasMark lo={lo} />}
          {e.isMe && <span className="pc-player__you">← {t(lo, "f.youTag")}</span>}
        </span>
      </td>
      <td className="pc-num pc-points">{e.points}</td>
    </tr>
  );
}

export default async function RecapPage({
  params,
}: {
  params: Promise<{ id: string; round: string }>;
}) {
  const { id, round: roundKey } = await params;
  const user = await requireUser(`/g/${id}/recap/${roundKey}`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, id);
  if (!access) notFound();
  const { group } = access;

  const lo = await getLocale();
  const now = new Date();
  const allMatches = getAllMatches(db);
  const round = getRound(allMatches, roundKey, now);
  if (!round) notFound();

  const label = roundLabel(lo, round);

  // round exists but hasn't kicked off yet
  if (!round.started) {
    return (
      <>
        <Header />
        <main className="page pc-flow">
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{label}</h1>
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">⏳</span>
            <p className="pc-empty__body">{t(lo, "recap.notStarted")}</p>
          </div>
          <Link href={`/g/${group.id}/recap`} className="pc-btn pc-btn--quiet pc-btn--sm">
            <ChevronLeft size={16} aria-hidden /> {t(lo, "recap.indexTitle")}
          </Link>
        </main>
        <GroupTabs groupId={group.id} active="recap" />
      </>
    );
  }

  const recap = getRoundRecapForUser(db, user.id, group.id, round);
  const global = getGlobalRoundStanding(db, user.id, round);
  const buddy = getPredictionBuddy(db, user.id);

  const showBest = recap.best && recap.best.points > 0;
  const nm = recap.nearMiss;
  const showNearMiss = nm && (!recap.best || nm.match.id !== recap.best.match.id);
  const missDesc = !nm
    ? ""
    : nm.soloExactMissed && nm.goalsAway === 1
      ? t(lo, "recap.missSolo")
      : nm.goalsAway === 1
        ? t(lo, "recap.missOneGoal")
        : t(lo, "recap.missGoals", { n: nm.goalsAway });

  const botLine =
    recap.botPoints === null
      ? null
      : recap.total > recap.botPoints
        ? t(lo, "recap.beatBot", { bot: "Claudio" })
        : recap.total === recap.botPoints
          ? t(lo, "recap.tieBot", { bot: "Claudio" })
          : t(lo, "recap.lostBot", { bot: "Claudio" });

  return (
    <>
      <Header />
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">
            {group.name} · {t(lo, "recap.eyebrow")}
          </span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{label}</h1>
          {!round.complete && (
            <p className="pc-hint" style={{ margin: "4px 0 0" }}>
              {t(lo, "recap.provisional")}
            </p>
          )}
        </div>

        {/* viewer's round summary */}
        <div className="pc-card pc-flow" style={{ gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "var(--magenta)" }}>
              {recap.total}
            </span>
            <span style={{ color: "var(--ink-soft)" }}>
              {t(lo, "recap.yourTotal")} · {t(lo, "g.exact")}: <b>{recap.exactCount}</b>
            </span>
          </div>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
            <Trophy size={16} style={{ color: "var(--amarillo-deep)" }} aria-hidden />
            {t(lo, "recap.rankLine", { rank: recap.rankInPolla, n: recap.pollaSize })}
          </p>
          {botLine && (
            <p style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0, color: "var(--ink-soft)" }}>
              <Bot size={16} aria-hidden /> {botLine}
            </p>
          )}
        </div>

        {/* best / worst highlights */}
        {showBest && (
          <div className="pc-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={20} style={{ color: "var(--verde)" }} aria-hidden />
            <span style={{ flex: 1 }}>
              <b>{t(lo, "recap.best")}</b>
              <br />
              {teamName(recap.best!.match.homeTeam, lo)} {recap.best!.match.regHome}–
              {recap.best!.match.regAway} {teamName(recap.best!.match.awayTeam, lo)}
              <br />
              <span className="pc-hint">
                {t(lo, "recap.yourScore")}:{" "}
                <span className="pc-pick">
                  {recap.best!.pred!.predHome}–{recap.best!.pred!.predAway}
                </span>
              </span>
            </span>
            <span className="pc-badge pc-badge--points">
              {t(lo, "f.plusPts", { n: recap.best!.points })}
            </span>
          </div>
        )}
        {showNearMiss && (
          <div className="pc-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={20} style={{ color: "var(--magenta)" }} aria-hidden />
            <span style={{ flex: 1 }}>
              <b>{t(lo, "recap.worst")}</b>
              <br />
              {teamName(nm!.match.homeTeam, lo)} {nm!.match.regHome}–
              {nm!.match.regAway} {teamName(nm!.match.awayTeam, lo)} ·{" "}
              <span className="pc-pick">
                {nm!.pred!.predHome}–{nm!.pred!.predAway}
              </span>
              <br />
              <span className="pc-hint">
                {missDesc}
                {nm!.missedPoints > nm!.points && (
                  <> {t(lo, "recap.missPoints", { n: nm!.missedPoints })}</>
                )}
              </span>
            </span>
            {nm!.goalsAway === 1 && (
              <span
                className="pc-badge pc-badge--comodin"
                aria-hidden
                style={{ whiteSpace: "nowrap" }}
              >
                💔
              </span>
            )}
          </div>
        )}

        {buddy && (
          <div className="pc-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={20} style={{ color: "var(--azul-deep)" }} aria-hidden />
            <span style={{ flex: 1 }}>
              <b>{t(lo, "recap.buddy")}</b>{" "}
              <span
                className="pc-player__name"
                style={{
                  fontWeight: 700,
                  ...(buddy.displayName ? {} : { fontStyle: "italic" }),
                }}
              >
                {buddy.displayName ?? buddy.alias}
              </span>
              {!buddy.displayName && buddy.alias && <> <AliasMark lo={lo} /></>}
              <br />
              <span className="pc-hint">{t(lo, "recap.buddyLine", { n: buddy.shared, total: buddy.total })}</span>
            </span>
            <span className="pc-badge pc-badge--points" aria-hidden>🤝</span>
          </div>
        )}

        {/* cross-polla glimpse */}
        <div className="pc-flow" style={{ gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t(lo, "recap.global")}</h2>
          <p className="pc-hint" style={{ margin: 0 }}>{t(lo, "recap.globalSub")}</p>
        </div>
        {global.eligible ? (
          <>
            <p style={{ margin: 0, fontSize: 15 }}>
              {t(lo, "recap.topPercent", { p: global.topPercent ?? 0, n: global.total })}
            </p>
            <table className="pc-board">
              <thead>
                <tr>
                  <th scope="col" aria-label="#">#</th>
                  <th scope="col">{t(lo, "g.who")}</th>
                  <th scope="col" className="pc-num">{t(lo, "g.pts")}</th>
                </tr>
              </thead>
              <tbody>
                {global.top.map((e) => (
                  <GlobalRow key={`t${e.rank}`} e={e} lo={lo} />
                ))}
                {(global.myRank ?? 0) > 4 && (
                  <>
                    <tr aria-hidden>
                      <td colSpan={3} style={{ textAlign: "center", color: "var(--ink-faint)" }}>···</td>
                    </tr>
                    {global.neighbors
                      .filter((e) => e.rank > 3)
                      .map((e) => (
                        <GlobalRow key={`n${e.rank}`} e={e} lo={lo} />
                      ))}
                  </>
                )}
              </tbody>
            </table>
          </>
        ) : (
          <div className="pc-card pc-empty">
            <p className="pc-empty__body">{t(lo, "recap.notEligible")}</p>
          </div>
        )}

        <Link href={`/g/${group.id}/recap`} className="pc-btn pc-btn--quiet pc-btn--sm">
          <ChevronLeft size={16} aria-hidden /> {t(lo, "recap.indexTitle")}
        </Link>
      </main>
      <GroupTabs groupId={group.id} active="recap" />
    </>
  );
}
