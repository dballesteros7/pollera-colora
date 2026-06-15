import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember, getUserGroups } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  getAllMatches,
  getUserPredictions,
  getGroupPredictionsForMatches,
  isLocked,
  isPredictable,
} from "@/lib/predictions";
import { parseScoringRules, PRESETS } from "@/lib/scoring/presets";
import { scoreMatch } from "@/lib/scoring/score";
import { getViewerTz, dayFormatter, timeFormatter } from "@/lib/viewer-tz";
import { getLocale, t, LOCALE_TAG } from "@/lib/i18n";
import { teamName } from "@/lib/teams";
import { Header, GroupTabs } from "@/app/components/shell";
import { ScoreInput } from "@/app/components/score-input";
import { FeedbackForm, PendingButton } from "@/app/components/feedback-form";
import { MatchBreakdown } from "@/app/components/match-breakdown";
import { ScrollToCurrent } from "@/app/components/scroll-to-current";
import { savePredictionAction, copyPredictionsAction } from "./actions";

const STAGE_KEY: Record<string, string> = {
  LAST_32: "f.r32",
  LAST_16: "f.r16",
  QUARTER_FINALS: "f.qf",
  SEMI_FINALS: "f.sf",
  THIRD_PLACE: "f.third",
  FINAL: "f.final",
};

type Match = ReturnType<typeof getAllMatches>[number];

function matchState(m: Match, now: Date): "tbd" | "open" | "locked" | "live" | "final" {
  if (m.status === "FINISHED") return "final";
  if (m.status === "IN_PLAY" || m.status === "PAUSED") return "live";
  if (isPredictable(m, now)) return "open";
  if (m.homeTeam === null || m.awayTeam === null) return "tbd";
  return "locked";
}

const STATE_BADGE: Record<string, { cls: string; key: string; dot?: boolean }> = {
  open: { cls: "pc-badge--open", key: "badge.open", dot: true },
  locked: { cls: "pc-badge--locked", key: "badge.locked" },
  live: { cls: "pc-badge--live", key: "badge.live", dot: true },
  final: { cls: "pc-badge--final", key: "badge.final" },
  tbd: { cls: "pc-badge--tbd", key: "badge.tbd" },
};

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}/fixtures`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, id);
  if (!access) notFound();
  const { group } = access;

  const now = new Date();
  const lo = await getLocale();
  const tz = await getViewerTz();
  const dayFormat = dayFormatter(tz, LOCALE_TAG[lo]);
  const timeFormat = timeFormatter(tz, LOCALE_TAG[lo]);
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];
  const matches = getAllMatches(db);
  const mine = getUserPredictions(db, user.id, group.id);
  const otherGroups = getUserGroups(db, user.id).filter((m) => m.group.id !== group.id);

  const openCount = matches.filter((m) => matchState(m, now) === "open").length;

  // one batch query for everyone's picks on revealed (locked/live/final) matches
  const revealedIds = matches
    .filter((m) => ["locked", "live", "final"].includes(matchState(m, now)))
    .map((m) => m.id);
  const groupPicks = getGroupPredictionsForMatches(db, group.id, revealedIds);

  const byDay = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = dayFormat.format(m.kickoffUtc);
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }

  // land the viewer on the current/next match instead of the top of a long list:
  // a live game if there is one, otherwise the next kickoff still to come
  const liveMatch = matches.find(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  );
  const target =
    liveMatch ?? matches.find((m) => m.kickoffUtc.getTime() >= now.getTime());

  return (
    <>
      <Header>
        {openCount > 0 && (
          <span className="pc-badge pc-badge--open">
            <span className="pc-dot" />
            {t(lo, "f.nOpen", { n: openCount })}
          </span>
        )}
      </Header>
      <main className="page pc-flow" style={{ gap: "var(--space-6)" }}>
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "f.title")}</h1>
          <p className="pc-hint" style={{ margin: "4px 0 0" }}>
            {t(lo, "f.hint")}
          </p>
        </div>

        {otherGroups.length > 0 && (
          <details className="pc-card pc-sheet">
            <summary>{t(lo, "f.copyFrom")}…</summary>
            <FeedbackForm
              action={copyPredictionsAction}
              doneMsg={t(lo, "ui.saved")}
              copiedMsg={t(lo, "ui.copiedN", { n: "{n}" })}
              zeroMsg={t(lo, "ui.copied0")}
              className="pc-page-actions"
              style={{ marginTop: "var(--space-2)" }}
            >
              <input type="hidden" name="groupId" value={group.id} />
              <select name="fromGroupId" className="pc-input" style={{ flex: 1 }} required defaultValue="">
                <option value="" disabled>
                  {t(lo, "f.copyFrom")}
                </option>
                {otherGroups.map(({ group: g }) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <PendingButton
                label={t(lo, "f.copyBtn")}
                pendingLabel={t(lo, "ui.saving")}
                className="pc-btn pc-btn--secondary pc-btn--sm"
              />
            </FeedbackForm>
            <p className="pc-hint" style={{ margin: "var(--space-2) 0 0" }}>
              {t(lo, "f.copyHint")}
            </p>
          </details>
        )}

        {matches.length === 0 && (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">📅</span>
            <span className="pc-empty__title">{t(lo, "f.emptyTitle")}</span>
            <p className="pc-empty__body">{t(lo, "f.emptyBody")}</p>
          </div>
        )}

        {[...byDay.entries()].map(([day, dayMatches]) => (
          <section key={day} className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>{day}</h2>
            {dayMatches.map((m) => {
              const state = matchState(m, now);
              const badge = STATE_BADGE[state];
              const pred = mine.get(m.id);
              const meta =
                m.stage === "GROUP_STAGE"
                  ? t(lo, "f.matchday", { n: m.matchday ?? "" })
                  : STAGE_KEY[m.stage]
                    ? t(lo, STAGE_KEY[m.stage])
                    : m.stage;
              const others =
                state === "locked" || state === "live" || state === "final"
                  ? (groupPicks.get(m.id) ?? [])
                  : [];
              const earned =
                state === "final" && pred && m.regHome !== null && m.regAway !== null
                  ? scoreMatch(pred, { regHome: m.regHome, regAway: m.regAway, stage: m.stage }, preset)
                  : null;

              return (
                <article
                  key={m.id}
                  id={`m${m.id}`}
                  className="pc-match"
                  data-state={state}
                >
                  <div className="pc-match__head">
                    <span className="pc-match__meta">{meta}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="pc-match__time">{timeFormat.format(m.kickoffUtc)}</span>
                      <span className={`pc-badge ${badge.cls}`}>
                        {badge.dot && <span className="pc-dot" />}
                        {t(lo, badge.key)}
                      </span>
                    </span>
                  </div>

                  {state === "open" ? (
                    <FeedbackForm
                      action={savePredictionAction}
                      doneMsg={t(lo, "ui.saved")}
                      errMsg={t(lo, "ui.lockedErr")}
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
                          aria={{ goals: t(lo, "f.goalsOf", { team: "{team}" }), minus: t(lo, "f.minus", { team: "{team}" }), plus: t(lo, "f.plus", { team: "{team}" }) }}
                        />
                      </div>
                      <div className="pc-match__footer">
                        {preset.joker && (
                          <>
                            <label className="pc-comodin">
                              <input type="checkbox" name="joker" defaultChecked={pred?.joker ?? false} />
                              {t(lo, "comodin")}
                            </label>
                            <span className="pc-comodin-hint">{t(lo, "f.jokerHint")}</span>
                          </>
                        )}
                        {otherGroups.length > 0 && (
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
                  ) : (
                    <div className="pc-match__body">
                      <div className="pc-match__row">
                        <span className="pc-team pc-team--home">
                          {m.homeCrest && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.homeCrest} alt="" className="pc-team__flag" width={26} height={19} />
                          )}
                          <span className="pc-team__name">{teamName(m.homeTeam, lo) ?? t(lo, "f.tbd")}</span>
                        </span>
                        <span className="pc-result">
                          {state === "tbd" || state === "locked" ? (
                            <span style={{ color: "var(--ink-faint)" }}>vs</span>
                          ) : (
                            <>
                              {state === "final" ? m.regHome : (m.finalHome ?? 0)} –{" "}
                              {state === "final" ? m.regAway : (m.finalAway ?? 0)}
                              {state === "final" && m.duration !== "REGULAR" && (
                                <small>
                                  {t(lo, "f.reg90", { h: m.finalHome ?? 0, a: m.finalAway ?? 0 })}
                                </small>
                              )}
                            </>
                          )}
                        </span>
                        <span className="pc-team pc-team--away">
                          {m.awayCrest && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.awayCrest} alt="" className="pc-team__flag" width={26} height={19} />
                          )}
                          <span className="pc-team__name">{teamName(m.awayTeam, lo) ?? t(lo, "f.tbd")}</span>
                        </span>
                      </div>

                      {state !== "tbd" && (
                        <div className="pc-match__pick">
                          <span>
                            {t(lo, "f.yourPick")}{" "}
                            {pred ? (
                              <b className="pc-pick">
                                {pred.predHome}–{pred.predAway}
                              </b>
                            ) : (
                              t(lo, "f.noPickPailas")
                            )}
                            {pred?.joker && (
                              <span className="pc-badge pc-badge--comodin" style={{ marginLeft: 8 }}>
                                {t(lo, "comodin").toLowerCase()}
                              </span>
                            )}
                          </span>
                          {earned && (
                            <span className={`pc-badge ${earned.points > 0 ? "pc-badge--points" : "pc-badge--locked"}`}>
                              {t(lo, "f.plusPts", { n: earned.points })}
                            </span>
                          )}
                        </div>
                      )}

                      {others.length > 0 &&
                        (state === "final" &&
                        m.regHome !== null &&
                        m.regAway !== null ? (
                          <MatchBreakdown
                            locale={lo}
                            preset={preset}
                            result={{
                              regHome: m.regHome,
                              regAway: m.regAway,
                              stage: m.stage,
                            }}
                            unico={rules.unicoAcertado}
                            picks={others.map((o) => ({
                              ...o,
                              isMe: o.userId === user.id,
                            }))}
                          />
                        ) : (
                          <div className="pc-picklist">
                            {others.map((o) => (
                              <span key={o.userId} className="pc-picklist__row">
                                <span className="pc-avatar pc-avatar--sm">
                                  {(o.displayName ?? "?").slice(0, 2)}
                                </span>
                                {o.displayName ?? "(sin nombre)"}
                                {o.joker && (
                                  <span className="pc-badge pc-badge--comodin">×2</span>
                                )}
                                <span className="pc-pick">
                                  {o.predHome}–{o.predAway}
                                </span>
                              </span>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </main>
      {target && <ScrollToCurrent targetId={`m${target.id}`} />}
      <GroupTabs groupId={group.id} active="fixtures" />
    </>
  );
}
