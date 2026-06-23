import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ListChecks,
  Star,
  ChevronRight,
  Crown,
  Trophy,
  Settings,
  Link as LinkIcon,
  Bot,
  Sparkles,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers, getUserGroups } from "@/lib/groups";
import { getLeaderboard } from "@/lib/leaderboard";
import { requireUser } from "@/lib/auth/require";
import { PRESETS, parseScoringRules } from "@/lib/scoring/presets";
import { getAllMatches, isPredictable, getUserPredictions } from "@/lib/predictions";
import { getGroupQuestions, getUserAnswers } from "@/lib/props";
import { bonusLocked, bonusDeadline } from "@/lib/bonus";
import { featuredRecapRound } from "@/lib/recap";
import { getViewerTz, dateTimeFormatter } from "@/lib/viewer-tz";
import { getLocale, t, LOCALE_TAG } from "@/lib/i18n";
import { teamName, patriotSides, scoreErrKey } from "@/lib/teams";
import { Header, GroupTabs } from "@/app/components/shell";
import { ScoreInput } from "@/app/components/score-input";
import { FeedbackForm, PendingButton } from "@/app/components/feedback-form";
import { ScoringSheet } from "@/app/components/scoring-rules";
import { savePredictionAction } from "./fixtures/actions";

function countdown(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, id);
  if (!access) notFound();

  const { group } = access;
  const now = new Date();
  const lo = await getLocale();
  const tz = await getViewerTz();
  const fmtDateTime = dateTimeFormatter(tz, LOCALE_TAG[lo]);
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];
  const board = getLeaderboard(db, group.id);
  const hasOtherGroups = getUserGroups(db, user.id).length > 1;
  const organizer = getGroupMembers(db, group.id).find((m) => m.role === "organizer");

  const matches = getAllMatches(db);
  const myPredictions = getUserPredictions(db, user.id, group.id);
  const openUnpredicted = matches.filter(
    (m) => isPredictable(m, now) && !myPredictions.has(m.id),
  ).length;

  // hero: a live match wins; otherwise the next kickoff within 48h
  const liveMatch = matches.find(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  );
  const nextMatch =
    liveMatch ??
    matches.find(
      (m) =>
        m.kickoffUtc > now &&
        m.kickoffUtc.getTime() - now.getTime() < 48 * 3600_000 &&
        m.homeTeam !== null,
    );
  const heroOpen = nextMatch ? isPredictable(nextMatch, now) : false;

  // Home carousel: every predictable match kicking off within the next 24h, so
  // late-night games (e.g. a 04:00-CEST kickoff) — and their patriotic Easter-egg
  // buttons — are still reachable while users are awake the day before, instead
  // of only surfacing as the hero in the dead of night. A live match leads as a
  // read-only slide. Falls back to the single hero card between matchdays.
  const next24hMs = now.getTime() + 24 * 3600_000;
  const dayMatches = matches.filter(
    (m) => isPredictable(m, now) && m.kickoffUtc.getTime() <= next24hMs,
  );
  const slideCount = (liveMatch ? 1 : 0) + dayMatches.length;

  const questions = getGroupQuestions(db, group.id);
  const myAnswers = getUserAnswers(db, group.id, user.id);
  const openProps = questions.filter(
    (r) => r.q.status === "approved" && now < r.q.lockAt && !myAnswers.has(r.q.id),
  ).length;

  const bonusClosed = bonusLocked(group, now);
  // nudge banner once the bonus close (end of group phase) is within 3 days
  const bonusClosesSoon =
    !bonusClosed &&
    bonusDeadline(group).getTime() - now.getTime() <= 3 * 24 * 3600_000;
  // a just-finished round gets a loud banner for ~2 days; the bottom-bar
  // "Resumen" tab handles general access once recaps go live
  const featuredRecap = featuredRecapRound(matches, now);

  type Match = (typeof matches)[number];

  // one open, predictable match → the full predict card (with its patriotic
  // Easter-egg button). Reused for every carousel slide and the single-hero
  // fallback. `featured` (the soonest one) shows the countdown; the rest show
  // their kickoff time so a late-night game reads clearly.
  const renderOpen = (m: Match, featured: boolean) => {
    const pred = myPredictions.get(m.id);
    const patriots = patriotSides(m.homeTeam, m.awayTeam);
    return (
      <article key={m.id} className="pc-match pc-hero-match" data-state="open">
        <div className="pc-match__head">
          <span className="pc-match__meta">
            {featured ? t(lo, "g.next") : fmtDateTime.format(m.kickoffUtc)}
          </span>
          {featured && (
            <span className="pc-countdown">
              {t(lo, "g.startsIn", { t: countdown(m.kickoffUtc.getTime() - now.getTime()) })}
            </span>
          )}
        </div>
        <FeedbackForm
          action={savePredictionAction}
          doneMsg={t(lo, "ui.saved")}
          errMsg={t(lo, "ui.lockedErr")}
          invalidMsg={t(lo, scoreErrKey(patriots))}
        >
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="matchId" value={m.id} />
          <div className="pc-match__body">
            <ScoreInput
              homeTeam={teamName(m.homeTeam, lo)!}
              awayTeam={teamName(m.awayTeam, lo)!}
              homeCrest={m.homeCrest}
              awayCrest={m.awayCrest}
              defaultHome={pred?.predHome ?? null}
              defaultAway={pred?.predAway ?? null}
              patriots={patriots}
              aria={{ goals: t(lo, "f.goalsOf", { team: "{team}" }), minus: t(lo, "f.minus", { team: "{team}" }), plus: t(lo, "f.plus", { team: "{team}" }) }}
            />
          </div>
          <div className="pc-match__footer">
            {preset.joker && (
              <label className="pc-comodin">
                <input type="checkbox" name="joker" defaultChecked={pred?.joker ?? false} />
                {t(lo, "comodin")}
              </label>
            )}
            {hasOtherGroups && (
              <label className="pc-hint" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" name="allGroups" style={{ accentColor: "var(--magenta)" }} />
                {t(lo, "f.alsoAll")}
              </label>
            )}
            <PendingButton
              label={pred ? t(lo, "btn.update") : t(lo, "btn.save")}
              pendingLabel={t(lo, "ui.saving")}
              className={`pc-btn ${pred ? "pc-btn--secondary" : "pc-btn--primary"} pc-btn--sm`}
              style={{ marginLeft: "auto" }}
            />
          </div>
        </FeedbackForm>
      </article>
    );
  };

  // a live match → read-only score, leads the carousel
  const renderLive = (m: Match) => (
    <article key={m.id} className="pc-match pc-hero-match" data-state="live">
      <div className="pc-match__head">
        <span className="pc-match__meta">{t(lo, "g.live")}</span>
        <span className="pc-badge pc-badge--live">
          <span className="pc-dot" />
          {t(lo, "badge.live")}
        </span>
      </div>
      <div className="pc-match__body">
        <div className="pc-match__row">
          <span className="pc-team pc-team--home">
            {m.homeCrest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.homeCrest} alt="" className="pc-team__flag" width={26} height={19} />
            )}
            <span className="pc-team__name">{teamName(m.homeTeam, lo)}</span>
          </span>
          <span className="pc-result">
            {m.finalHome ?? 0} – {m.finalAway ?? 0}
          </span>
          <span className="pc-team pc-team--away">
            {m.awayCrest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.awayCrest} alt="" className="pc-team__flag" width={26} height={19} />
            )}
            <span className="pc-team__name">{teamName(m.awayTeam, lo)}</span>
          </span>
        </div>
      </div>
    </article>
  );

  // the single-hero fallback when the next match isn't predictable yet
  const renderLocked = (m: Match) => {
    const pred = myPredictions.get(m.id);
    return (
      <article key={m.id} className="pc-match pc-hero-match" data-state="locked">
        <div className="pc-match__head">
          <span className="pc-match__meta">{t(lo, "g.next")}</span>
          <span className="pc-countdown">
            {t(lo, "g.startsIn", { t: countdown(m.kickoffUtc.getTime() - now.getTime()) })}
          </span>
        </div>
        <div className="pc-match__body">
          <div className="pc-match__row">
            <span className="pc-team pc-team--home">
              {m.homeCrest && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.homeCrest} alt="" className="pc-team__flag" width={26} height={19} />
              )}
              <span className="pc-team__name">{teamName(m.homeTeam, lo)}</span>
            </span>
            <span className="pc-result">
              <span style={{ color: "var(--ink-faint)" }}>vs</span>
            </span>
            <span className="pc-team pc-team--away">
              {m.awayCrest && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.awayCrest} alt="" className="pc-team__flag" width={26} height={19} />
              )}
              <span className="pc-team__name">{teamName(m.awayTeam, lo)}</span>
            </span>
          </div>
          <div className="pc-match__pick">
            <span>
              {fmtDateTime.format(m.kickoffUtc)} · {t(lo, "g.yourPick")}:{" "}
              {pred ? (
                <b className="pc-pick">
                  {pred.predHome}–{pred.predAway}
                </b>
              ) : (
                t(lo, "g.noPick")
              )}
            </span>
            <Link href={`/g/${group.id}/fixtures`} className="pc-btn pc-btn--quiet pc-btn--sm">
              {t(lo, "g.seeMatches")}
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      <Header>
        <Link href={`/g/${group.id}/settings`} className="pc-iconbtn" aria-label={t(lo, "a11y.settings")}>
          <Settings size={20} aria-hidden />
        </Link>
      </Header>
      <main className="page pc-flow">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">{group.name}</span>
            <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "g.title")}</h1>
          </div>
          {organizer?.displayName && (
            <span className="pc-badge pc-badge--organiza">
              <Crown size={14} aria-hidden /> {t(lo, "badge.organiza", { name: organizer.displayName.split(" ")[0] })}
            </span>
          )}
        </div>

        {featuredRecap && (
          <Link
            href={`/g/${group.id}/recap/${featuredRecap.key}`}
            className="pc-card pc-quicklink"
            style={{
              borderColor: "var(--magenta)",
              background: "color-mix(in srgb, var(--magenta) 8%, transparent)",
            }}
          >
            <span className="pc-quicklink__icon" style={{ color: "var(--magenta)" }}>
              <Sparkles size={24} aria-hidden />
            </span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {t(lo, "g.recapTitle")}
                <span className="pc-badge pc-badge--open"><span className="pc-dot" />{t(lo, "g.recapReadyBadge")}</span>
              </span>
              <span className="pc-quicklink__sub">{t(lo, "g.recapReady")}</span>
            </span>
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
        )}

        {bonusClosesSoon && (
          <Link
            href={`/g/${group.id}/bonus`}
            className="pc-card pc-quicklink"
            style={{
              borderColor: "var(--amarillo-deep)",
              background: "color-mix(in srgb, var(--amarillo) 12%, transparent)",
            }}
          >
            <span className="pc-quicklink__icon" style={{ color: "var(--amarillo-deep)" }}>
              <Star size={24} aria-hidden />
            </span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">{t(lo, "g.bonusClosingTitle")}</span>
              <span className="pc-quicklink__sub">
                {t(lo, "g.bonusClosingSub", { when: fmtDateTime.format(bonusDeadline(group)) })}
              </span>
            </span>
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
        )}

        {slideCount > 0 ? (
          <section className="pc-carousel-wrap" aria-label={t(lo, "g.today")}>
            <div className="pc-carousel__head">
              <span className="pc-match__meta">{t(lo, "g.today")}</span>
              {slideCount > 1 && (
                <span className="pc-carousel__hint" aria-hidden>
                  {slideCount}
                  <ChevronRight size={14} />
                </span>
              )}
            </div>
            <div
              className={`pc-carousel${slideCount === 1 ? " pc-carousel--single" : ""}`}
              role="group"
              aria-label={t(lo, "g.today")}
            >
              {liveMatch && renderLive(liveMatch)}
              {dayMatches.map((m, i) => renderOpen(m, i === 0))}
            </div>
          </section>
        ) : nextMatch ? (
          heroOpen ? renderOpen(nextMatch, true) : renderLocked(nextMatch)
        ) : null}

        {board.length <= 1 && board.every((r) => r.total === 0) ? (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">🏆</span>
            <span className="pc-empty__title">{t(lo, "g.emptyTitle")}</span>
            <p className="pc-empty__body">
              {t(lo, "g.emptyBody")}
            </p>
          </div>
        ) : (
          <table className="pc-board">
            <thead>
              <tr>
                <th scope="col" aria-label="Puesto">#</th>
                <th scope="col">{t(lo, "g.who")}</th>
                <th scope="col" className="pc-num">{t(lo, "g.pts")}</th>
                <th scope="col" className="pc-num">{t(lo, "g.exact")}</th>
              </tr>
            </thead>
            <tbody>
              {board.map((row, i) => (
                <tr key={row.userId} className={row.userId === user.id ? "is-you" : undefined}>
                  <td>
                    {i < 3 ? (
                      <span className={`pc-medal pc-medal--${i + 1}`}>{i + 1}</span>
                    ) : (
                      <span className="pc-rank">{i + 1}</span>
                    )}
                  </td>
                  <td>
                    <span className="pc-player">
                      <span className="pc-player__name">{row.displayName ?? "(sin nombre)"}</span>
                      {row.isBot && (
                        <Bot size={15} className="pc-bot-badge" aria-label={t(lo, "a11y.bot")} />
                      )}
                      {row.userId === user.id && (
                        <span className="pc-player__you">← {t(lo, "f.youTag")}</span>
                      )}
                    </span>
                  </td>
                  <td className="pc-num pc-points">{row.total}</td>
                  <td className="pc-num pc-exact">{row.exactCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {group.potNote && (
          <p style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            <Trophy size={15} style={{ color: "var(--amarillo-deep)" }} aria-hidden /> {t(lo, "g.vaca", { note: group.potNote })}
          </p>
        )}

        <ScoringSheet preset={preset} rules={rules} locale={lo} />

        <div className="pc-flow" style={{ gap: "var(--gap-card)" }}>
          <Link href={`/g/${group.id}/fixtures`} className="pc-card pc-quicklink">
            <span className="pc-quicklink__icon"><CalendarDays size={22} aria-hidden /></span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">{t(lo, "g.predict")}</span>
              <span className="pc-quicklink__sub">{t(lo, "g.predictSub")}</span>
            </span>
            {openUnpredicted > 0 && (
              <span className="pc-badge pc-badge--open"><span className="pc-dot" />{t(lo, "g.unmarked", { n: openUnpredicted })}</span>
            )}
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
          <Link href={`/g/${group.id}/props`} className="pc-card pc-quicklink">
            <span className="pc-quicklink__icon"><ListChecks size={22} aria-hidden /></span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">{t(lo, "r.title")}</span>
              <span className="pc-quicklink__sub">{t(lo, "g.recochaSub")}</span>
            </span>
            {openProps > 0 && <span className="pc-badge">{openProps}</span>}
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
          <Link href={`/g/${group.id}/bonus`} className="pc-card pc-quicklink">
            <span className="pc-quicklink__icon"><Star size={22} aria-hidden /></span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">{t(lo, "g.bonusTitle")}</span>
              <span className="pc-quicklink__sub">
                {bonusClosed
                  ? t(lo, "g.bonusClosed")
                  : bonusClosesSoon
                    ? t(lo, "g.bonusSoon")
                    : t(lo, "g.bonusOpen")}
              </span>
            </span>
            {bonusClosed ? (
              <span className="pc-badge pc-badge--locked">{t(lo, "badge.locked")}</span>
            ) : (
              <span className="pc-badge pc-badge--open"><span className="pc-dot" />{t(lo, "badge.open")}</span>
            )}
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
        </div>

        <p className="pc-hint" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <LinkIcon size={14} aria-hidden /> {t(lo, "g.invite")}{" "}
          <code className="num">{process.env.APP_URL ?? ""}/join/{group.inviteCode}</code>
        </p>

        <details className="pc-card pc-sheet">
          <summary>{t(lo, "explain.title")}</summary>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
            {t(lo, "explain.body")}
          </p>
        </details>
      </main>
      <GroupTabs groupId={group.id} active="home" />
    </>
  );
}
