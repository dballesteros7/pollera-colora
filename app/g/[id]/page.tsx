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
import { getViewerTz, dateTimeFormatter, timeFormatter } from "@/lib/viewer-tz";
import { getLocale, t, LOCALE_TAG } from "@/lib/i18n";
import { teamName, teamAbbrev, patriotSides, scoreErrKey } from "@/lib/teams";
import { Header, GroupTabs } from "@/app/components/shell";
import { ScoreInput } from "@/app/components/score-input";
import { DayBoard, type DayChip } from "@/app/components/day-board";
import { FeedbackForm, PendingButton } from "@/app/components/feedback-form";
import { ScoringSheet } from "@/app/components/scoring-rules";
import { savePredictionAction } from "./fixtures/actions";
import {
  getSuperIdentity,
  superLeaderboard,
  SUPER_PRESET,
  isKnockoutStage,
  homePollaIdOf,
} from "@/lib/super-polla";
import { setSuperIdentityAction } from "./super-actions";

// knockout-stage labels for the Súper Polla pick cards
const SUPER_STAGE_KEY: Record<string, string> = {
  LAST_32: "f.r32",
  LAST_16: "f.r16",
  QUARTER_FINALS: "f.qf",
  SEMI_FINALS: "f.sf",
  THIRD_PLACE: "f.third",
  FINAL: "f.final",
};

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
  const fmtTime = timeFormatter(tz, LOCALE_TAG[lo]);
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];
  const board = getLeaderboard(db, group.id);

  // The Súper Polla is read-only: no pick entry, no invite, no sub-tabs — just
  // the global glory table over everyone's home-polla knockout picks.
  if (group.isSuper) {
    const superBoard = superLeaderboard(db, user.id);
    const noScores = superBoard.every((r) => r.total === 0);
    const decided = getSuperIdentity(db, user.id) !== null;

    // First open: a cheerful interstitial explaining what the Súper Polla is,
    // and the one-time choice of how you want to appear. Shown until decided.
    if (!decided) {
      return (
        <main className="pc-hero-shell">
          <div className="pc-tricolor-rule" />
          <div className="pc-hero-shell__center">
            <div className="pc-hero-head">
              <span style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>🏆</span>
              <h1 style={{ margin: 0 }}>{t(lo, "super.welcomeTitle")}</h1>
              <p style={{ color: "var(--ink-soft)", margin: "8px 0 0" }}>
                {t(lo, "super.welcomeBody")}
              </p>
            </div>
            <div className="pc-card pc-card--pad-lg pc-flow">
              <div>
                <span className="pc-quicklink__label">{t(lo, "super.identityTitle")}</span>
                <p className="pc-hint" style={{ margin: "4px 0 0" }}>{t(lo, "super.identityBody")}</p>
              </div>
              <form action={setSuperIdentityAction} className="pc-flow" style={{ gap: 8 }}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="nickname" />
                <div className="pc-field">
                  <input
                    className="pc-input"
                    name="nickname"
                    placeholder={t(lo, "super.nicknamePh")}
                    required
                    minLength={2}
                    maxLength={40}
                    autoFocus
                  />
                </div>
                <button type="submit" className="pc-btn pc-btn--primary pc-btn--block">
                  {t(lo, "super.useNickname")}
                </button>
              </form>
              <form action={setSuperIdentityAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="real" />
                <button type="submit" className="pc-btn pc-btn--quiet pc-btn--block">
                  {t(lo, "super.keepName", { name: user.displayName ?? "" })}
                </button>
              </form>
            </div>
          </div>
        </main>
      );
    }

    // your own Súper Polla picks for the open knockout matches; the home polla's
    // pick pre-fills the input as a convenience until you save your own
    const homeId = homePollaIdOf(db, user.id);
    const ownPicks = getUserPredictions(db, user.id, group.id);
    const homePicks = homeId ? getUserPredictions(db, user.id, homeId) : new Map();
    const pickMatches = getAllMatches(db)
      .filter((m) => isKnockoutStage(m.stage) && isPredictable(m, now))
      .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());
    const superAria = {
      goals: t(lo, "f.goalsOf", { team: "{team}" }),
      minus: t(lo, "f.minus", { team: "{team}" }),
      plus: t(lo, "f.plus", { team: "{team}" }),
    };

    // one swipeable card at a time (kicker-style strip) instead of a tall stack,
    // so making a pick doesn't bury the glory table below
    const renderSuperPick = (m: (typeof pickMatches)[number]) => {
      const own = ownPicks.get(m.id);
      const eff = own ?? homePicks.get(m.id);
      const copied = !own && Boolean(homePicks.get(m.id));
      return (
        <article key={m.id} className="pc-match pc-hero-match" data-state="open">
          <div className="pc-match__head">
            <span className="pc-match__meta">
              {SUPER_STAGE_KEY[m.stage] ? t(lo, SUPER_STAGE_KEY[m.stage]) : m.stage}
            </span>
            <span className="pc-match__time">{fmtDateTime.format(m.kickoffUtc)}</span>
          </div>
          <FeedbackForm
            action={savePredictionAction}
            doneMsg={t(lo, "ui.saved")}
            errMsg={t(lo, "ui.lockedErr")}
            invalidMsg={t(lo, "ui.scoreErr")}
          >
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="matchId" value={m.id} />
            <div className="pc-match__body">
              <ScoreInput
                homeTeam={teamName(m.homeTeam, lo)!}
                awayTeam={teamName(m.awayTeam, lo)!}
                homeCrest={m.homeCrest}
                awayCrest={m.awayCrest}
                defaultHome={eff?.predHome ?? null}
                defaultAway={eff?.predAway ?? null}
                aria={superAria}
              />
            </div>
            <div className="pc-match__footer">
              {copied && (
                <p className="pc-hint" style={{ flexBasis: "100%", margin: 0 }}>
                  {t(lo, "super.copiedHint")}
                </p>
              )}
              <label className="pc-comodin">
                <input type="checkbox" name="joker" defaultChecked={eff?.joker ?? false} />
                {t(lo, "comodin")}
              </label>
              <PendingButton
                label={own ? t(lo, "btn.update") : t(lo, "btn.save")}
                pendingLabel={t(lo, "ui.saving")}
                className={`pc-btn ${own ? "pc-btn--secondary" : "pc-btn--primary"} pc-btn--sm`}
                style={{ marginLeft: "auto" }}
              />
            </div>
          </FeedbackForm>
        </article>
      );
    };

    const pickChips: DayChip[] = pickMatches.map((m) => ({
      key: String(m.id),
      home: teamAbbrev(m.homeTeam),
      away: teamAbbrev(m.awayTeam),
      homeCrest: m.homeCrest,
      awayCrest: m.awayCrest,
      center: fmtTime.format(m.kickoffUtc),
      live: false,
    }));
    const pickDetails = pickMatches.map(renderSuperPick);

    return (
      <>
        <Header />
        <main className="page pc-flow">
          <div>
            <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--magenta)" }}>
              <Trophy size={14} aria-hidden /> {t(lo, "super.title")}
            </span>
            <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "super.tag")}</h1>
          </div>

          {pickMatches.length > 0 && (
            <section className="pc-flow" style={{ gap: "var(--space-2)" }}>
              <div>
                <span className="pc-quicklink__label">{t(lo, "super.pickTitle")}</span>
                <p className="pc-hint" style={{ margin: "4px 0 0" }}>{t(lo, "super.pickSub")}</p>
              </div>
              <DayBoard
                label={t(lo, "super.pickTitle")}
                chips={pickChips}
                details={pickDetails}
                defaultIndex={0}
              />
            </section>
          )}

          {noScores ? (
            <div className="pc-card pc-empty">
              <span className="pc-empty__art">🏆</span>
              <span className="pc-empty__title">{t(lo, "super.emptyTitle")}</span>
              <p className="pc-empty__body">{t(lo, "super.emptyBody")}</p>
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
                {superBoard.map((row) => (
                  <tr key={row.userId} className={row.isYou ? "is-you" : undefined}>
                    <td>
                      {row.rank <= 3 ? (
                        <span className={`pc-medal pc-medal--${row.rank}`}>{row.rank}</span>
                      ) : (
                        <span className="pc-rank">{row.rank}</span>
                      )}
                    </td>
                    <td>
                      <span className="pc-player">
                        <span
                          className="pc-player__name"
                          style={row.masked ? { fontStyle: "italic", color: "var(--ink-soft)" } : undefined}
                        >
                          {row.name}
                        </span>
                        {row.isBot && (
                          <Bot size={15} className="pc-bot-badge" aria-label={t(lo, "a11y.bot")} />
                        )}
                        {row.isYou && (
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

          <ScoringSheet preset={SUPER_PRESET} rules={rules} locale={lo} />

          <details className="pc-card pc-sheet" open>
            <summary>{t(lo, "super.explainTitle")}</summary>
            <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
              {t(lo, "super.explainBody")}
            </p>
            <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
              {t(lo, "super.jokerNote")}
            </p>
          </details>
        </main>
      </>
    );
  }

  const hasOtherGroups = getUserGroups(db, user.id).length > 1;
  const organizer = getGroupMembers(db, group.id).find((m) => m.role === "organizer");

  const matches = getAllMatches(db);
  const myPredictions = getUserPredictions(db, user.id, group.id);
  const openUnpredicted = matches.filter(
    (m) => isPredictable(m, now) && !myPredictions.has(m.id),
  ).length;

  // hero: a live match wins; otherwise the next kickoff within 48h. The final
  // group-stage round kicks both games off simultaneously, so there can be more
  // than one live match — each gets its own carousel slide, the first leads.
  const liveMatches = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  );
  const liveMatch = liveMatches[0];
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

  type Match = (typeof matches)[number];
  // a live match leads the strip, then the predictable matches in kickoff order
  const daySlides: { m: Match; kind: "live" | "open" }[] = [
    ...liveMatches.map((m) => ({ m, kind: "live" as const })),
    ...dayMatches.map((m) => ({ m, kind: "open" as const })),
  ];
  const firstOpenIdx = liveMatches.length;
  const dayChips: DayChip[] = daySlides.map(({ m, kind }) => ({
    key: String(m.id),
    home: teamAbbrev(m.homeTeam),
    away: teamAbbrev(m.awayTeam),
    homeCrest: m.homeCrest,
    awayCrest: m.awayCrest,
    center:
      kind === "live"
        ? `${m.finalHome ?? 0}–${m.finalAway ?? 0}`
        : fmtTime.format(m.kickoffUtc),
    live: kind === "live",
  }));

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
          <span className="pc-countdown">
            {t(lo, "g.startsIn", { t: countdown(m.kickoffUtc.getTime() - now.getTime()) })}
          </span>
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

  // the detail cards, in strip order — the client board shows the selected one
  const dayDetails = daySlides.map(({ m, kind }, i) =>
    kind === "live" ? renderLive(m) : renderOpen(m, i === firstOpenIdx),
  );

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

        {daySlides.length > 0 ? (
          <DayBoard
            label={t(lo, "g.today")}
            chips={dayChips}
            details={dayDetails}
            defaultIndex={0}
          />
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
