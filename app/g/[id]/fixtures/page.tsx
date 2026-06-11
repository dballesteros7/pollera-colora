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
import { Header, GroupTabs } from "@/app/components/shell";
import { ScoreInput } from "@/app/components/score-input";
import { savePredictionAction } from "./actions";

const dayFormat = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Bogota",
});
const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Bogota",
});

const STAGE_LABEL: Record<string, string> = {
  GROUP_STAGE: "Fase de grupos",
  LAST_32: "Dieciseisavos",
  LAST_16: "Octavos",
  QUARTER_FINALS: "Cuartos",
  SEMI_FINALS: "Semifinal",
  THIRD_PLACE: "Tercer puesto",
  FINAL: "La final",
};

type Match = ReturnType<typeof getAllMatches>[number];

function matchState(m: Match, now: Date): "tbd" | "open" | "locked" | "live" | "final" {
  if (m.status === "FINISHED") return "final";
  if (m.status === "IN_PLAY" || m.status === "PAUSED") return "live";
  if (isPredictable(m, now)) return "open";
  if (m.homeTeam === null || m.awayTeam === null) return "tbd";
  return isLocked(m, now) ? "locked" : "locked";
}

const STATE_BADGE: Record<string, { cls: string; label: string; dot?: boolean }> = {
  open: { cls: "pc-badge--open", label: "abierto", dot: true },
  locked: { cls: "pc-badge--locked", label: "cerrado" },
  live: { cls: "pc-badge--live", label: "en juego", dot: true },
  final: { cls: "pc-badge--final", label: "final" },
  tbd: { cls: "pc-badge--tbd", label: "por definir" },
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
            {openCount} abiertos
          </span>
        )}
      </Header>
      <main className="page pc-flow" style={{ gap: "var(--space-6)" }}>
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>Partidos</h1>
          <p className="pc-hint" style={{ margin: "4px 0 0" }}>
            Hora colombiana. Podés cambiar tu pronóstico hasta el pitazo.
          </p>
        </div>

        {matches.length === 0 && (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">📅</span>
            <span className="pc-empty__title">Sin calendario todavía</span>
            <p className="pc-empty__body">Los partidos aparecen apenas se sincronicen.</p>
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
                  ? `Fase de grupos · Fecha ${m.matchday ?? ""}`
                  : (STAGE_LABEL[m.stage] ?? m.stage);
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
                        {badge.label}
                      </span>
                    </span>
                  </div>

                  {state === "open" ? (
                    <form action={savePredictionAction}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="matchId" value={m.id} />
                      <div className="pc-match__body">
                        <ScoreInput
                          homeTeam={m.homeTeam!}
                          awayTeam={m.awayTeam!}
                          homeCrest={m.homeCrest}
                          awayCrest={m.awayCrest}
                          defaultHome={pred?.predHome ?? null}
                          defaultAway={pred?.predAway ?? null}
                        />
                      </div>
                      <div className="pc-match__footer">
                        {preset.joker && (
                          <label className="pc-comodin">
                            <input type="checkbox" name="joker" defaultChecked={pred?.joker ?? false} />
                            Comodín ×2
                          </label>
                        )}
                        <button
                          type="submit"
                          className="pc-btn pc-btn--primary pc-btn--sm"
                          style={{ marginLeft: "auto" }}
                        >
                          {pred ? "Actualizar" : "Guardar"}
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
                          <span className="pc-team__name">{m.homeTeam ?? "Por definir"}</span>
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
                                  en los 90 · terminó {m.finalHome}–{m.finalAway}
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
                          <span className="pc-team__name">{m.awayTeam ?? "Por definir"}</span>
                        </span>
                      </div>

                      {state !== "tbd" && (
                        <div className="pc-match__pick">
                          <span>
                            Tu pronóstico:{" "}
                            {pred ? (
                              <b className="pc-pick">
                                {pred.predHome}–{pred.predAway}
                              </b>
                            ) : (
                              "no marcaste — pailas"
                            )}
                            {pred?.joker && (
                              <span className="pc-badge pc-badge--comodin" style={{ marginLeft: 8 }}>
                                comodín ×2
                              </span>
                            )}
                          </span>
                          {earned && (
                            <span className={`pc-badge ${earned.points > 0 ? "pc-badge--points" : "pc-badge--locked"}`}>
                              +{earned.points} pts
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
