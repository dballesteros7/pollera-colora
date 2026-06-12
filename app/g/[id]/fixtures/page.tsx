import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  getAllMatches,
  getUserPredictions,
  getGroupPredictionsForMatch,
  isLocked,
  isPredictable,
} from "@/lib/predictions";
import { parseScoringRules, PRESETS } from "@/lib/scoring/presets";
import { scoreMatch } from "@/lib/scoring/score";
import { getViewerTz, dayFormatter, timeFormatter } from "@/lib/viewer-tz";
import { getLocale, t, LOCALE_TAG, type Locale } from "@/lib/i18n";
import { teamName } from "@/lib/teams";
import { Header, GroupTabs } from "@/app/components/shell";
import { ScoreInput } from "@/app/components/score-input";
import { savePredictionAction } from "./actions";

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
  return isLocked(m, now) ? "locked" : "locked";
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

  const openCount = matches.filter((m) => matchState(m, now) === "open").length;

  const byDay = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = dayFormat.format(m.kickoffUtc);
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }

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
                  ? getGroupPredictionsForMatch(db, group.id, m.id)
                  : [];
              const earned =
                state === "final" && pred && m.regHome !== null && m.regAway !== null
                  ? scoreMatch(pred, { regHome: m.regHome, regAway: m.regAway, stage: m.stage }, preset)
                  : null;

              return (
                <article key={m.id} className="pc-match" data-state={state}>
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
                    <form action={savePredictionAction}>
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
                          <label className="pc-comodin">
                            <input type="checkbox" name="joker" defaultChecked={pred?.joker ?? false} />
                            {t(lo, "comodin")}
                          </label>
                        )}
                        <button
                          type="submit"
                          className={`pc-btn ${pred ? "pc-btn--secondary" : "pc-btn--primary"} pc-btn--sm`}
                          style={{ marginLeft: "auto" }}
                        >
                          {pred ? t(lo, "btn.update") : t(lo, "btn.save")}
                        </button>
                      </div>
                    </form>
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

                      {others.length > 0 && (
                        <div className="pc-picklist">
                          {others.map((o) => (
                            <span key={o.userId} className="pc-picklist__row">
                              <span className="pc-avatar pc-avatar--sm">
                                {(o.displayName ?? "?").slice(0, 2)}
                              </span>
                              {o.displayName ?? "(sin nombre)"}
                              {o.joker && <span className="pc-badge pc-badge--comodin">×2</span>}
                              <span className="pc-pick">
                                {o.predHome}–{o.predAway}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </main>
      <GroupTabs groupId={group.id} active="fixtures" />
    </>
  );
}
