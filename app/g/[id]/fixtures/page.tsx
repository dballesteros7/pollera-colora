import Link from "next/link";
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
import { savePredictionAction } from "./actions";

const dayFormat = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Bogota",
});
const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

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
  const hasJoker = PRESETS[rules.preset].joker;
  const matches = getAllMatches(db);
  const mine = getUserPredictions(db, user.id, group.id);

  if (matches.length === 0) {
    return (
      <main>
        <p>
          <Link href={`/g/${group.id}`}>← {group.name}</Link>
        </p>
        <h1>Partidos</h1>
        <p>El calendario aún no se ha sincronizado.</p>
      </main>
    );
  }

  // group by day (Bogotá time) for readable chunks
  const byDay = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = dayFormat.format(m.kickoffUtc);
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }

  return (
    <main>
      <p>
        <Link href={`/g/${group.id}`}>← {group.name}</Link>
      </p>
      <h1>Partidos</h1>
      {/* Hora colombiana — viewer-local timezones come with the design pass */}

      {[...byDay.entries()].map(([day, dayMatches]) => (
        <section key={day}>
          <h2>{day}</h2>
          {dayMatches.map((m) => {
            const locked = isLocked(m, now);
            const open = isPredictable(m, now);
            const pred = mine.get(m.id);
            const others = locked
              ? getGroupPredictionsForMatch(db, group.id, m.id)
              : [];
            return (
              <article key={m.id}>
                <h3>
                  {m.homeTeam ?? "Por definir"} vs {m.awayTeam ?? "Por definir"}{" "}
                  · {timeFormat.format(m.kickoffUtc)}
                </h3>
                {m.status === "FINISHED" && (
                  <p>
                    Final: {m.regHome}–{m.regAway}
                    {m.duration !== "REGULAR" &&
                      ` (en los 90 — terminó ${m.finalHome}–${m.finalAway})`}
                  </p>
                )}
                {(m.status === "IN_PLAY" || m.status === "PAUSED") && (
                  <p>
                    En juego: {m.finalHome ?? 0}–{m.finalAway ?? 0}
                  </p>
                )}

                {open ? (
                  <form action={savePredictionAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="matchId" value={m.id} />
                    <input
                      type="number"
                      name="predHome"
                      min={0}
                      max={99}
                      required
                      defaultValue={pred?.predHome ?? ""}
                      aria-label={`Goles ${m.homeTeam}`}
                    />
                    {" – "}
                    <input
                      type="number"
                      name="predAway"
                      min={0}
                      max={99}
                      required
                      defaultValue={pred?.predAway ?? ""}
                      aria-label={`Goles ${m.awayTeam}`}
                    />
                    {hasJoker && (
                      <label>
                        <input
                          type="checkbox"
                          name="joker"
                          defaultChecked={pred?.joker ?? false}
                        />
                        Comodín (×2)
                      </label>
                    )}
                    <button type="submit">
                      {pred ? "Actualizar" : "Guardar"}
                    </button>
                  </form>
                ) : locked ? (
                  <div>
                    <p>
                      Tu pronóstico:{" "}
                      {pred
                        ? `${pred.predHome}–${pred.predAway}${pred.joker ? " (comodín)" : ""}`
                        : "no pronosticaste"}
                    </p>
                    {others.length > 0 && (
                      <details>
                        <summary>Pronósticos del grupo ({others.length})</summary>
                        <ul>
                          {others.map((o) => (
                            <li key={o.userId}>
                              {o.displayName ?? "(sin nombre)"}: {o.predHome}–
                              {o.predAway}
                              {o.joker && " (comodín)"}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ) : (
                  <p>Se abre cuando se definan los equipos.</p>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </main>
  );
}
