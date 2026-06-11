import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllMatches } from "@/lib/predictions";
import { BONUS_CATEGORIES, getOutcomes, getKnownTeams } from "@/lib/bonus";
import { Header } from "@/app/components/shell";
import { overrideMatchAction, setOutcomesAction } from "./actions";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  const db = getDb();
  const matches = getAllMatches(db);
  const outcomes = getOutcomes(db);
  const teams = getKnownTeams(db);

  return (
    <>
      <Header>
        <span className="pc-badge pc-badge--organiza">admin</span>
      </Header>
      <main className="page page--wide pc-flow">
        <h1 style={{ fontSize: 26, margin: 0 }}>Admin</h1>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>Resultados del torneo</h2>
          <form action={setOutcomesAction} className="pc-flow">
            {BONUS_CATEGORIES.map((cat) => (
              <div className="pc-field" key={cat.id}>
                <label className="pc-label" htmlFor={`outcome_${cat.id}`}>{cat.label}</label>
                {cat.team ? (
                  <select
                    id={`outcome_${cat.id}`}
                    name={`outcome_${cat.id}`}
                    className="pc-input"
                    defaultValue={outcomes.get(cat.id) ?? ""}
                  >
                    <option value="">— sin definir —</option>
                    {teams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`outcome_${cat.id}`}
                    name={`outcome_${cat.id}`}
                    className="pc-input"
                    defaultValue={outcomes.get(cat.id) ?? ""}
                  />
                )}
              </div>
            ))}
            <button type="submit" className="pc-btn pc-btn--primary">
              Guardar resultados
            </button>
          </form>
        </section>

        <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
          <h2 style={{ fontSize: 18, margin: "0 2px" }}>Partidos ({matches.length})</h2>
          {matches.map((m) => (
            <article key={m.id} className="pc-card pc-flow" style={{ gap: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b>
                  #{m.id} {m.homeTeam ?? "?"} vs {m.awayTeam ?? "?"}
                </b>
                <span className="pc-badge">{m.status}</span>
                {m.manualOverride && <span className="pc-badge pc-badge--live">OVERRIDE</span>}
              </div>
              <p className="pc-hint num" style={{ margin: 0 }}>
                {m.kickoffUtc.toISOString()} · 90&apos;: {m.regHome ?? "–"}-{m.regAway ?? "–"} ·
                final: {m.finalHome ?? "–"}-{m.finalAway ?? "–"}
              </p>
              <form action={overrideMatchAction} className="pc-page-actions">
                <input type="hidden" name="matchId" value={m.id} />
                <input type="number" name="regHome" className="pc-input" style={{ width: 80 }} placeholder="90' L" defaultValue={m.regHome ?? ""} aria-label="90 local" />
                <input type="number" name="regAway" className="pc-input" style={{ width: 80 }} placeholder="90' V" defaultValue={m.regAway ?? ""} aria-label="90 visita" />
                <input type="number" name="finalHome" className="pc-input" style={{ width: 80 }} placeholder="fin L" defaultValue={m.finalHome ?? ""} aria-label="final local" />
                <input type="number" name="finalAway" className="pc-input" style={{ width: 80 }} placeholder="fin V" defaultValue={m.finalAway ?? ""} aria-label="final visita" />
                <label className="pc-hint" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" name="clear" /> soltar override
                </label>
                <button type="submit" className="pc-btn pc-btn--ghost pc-btn--sm">
                  Aplicar
                </button>
              </form>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
