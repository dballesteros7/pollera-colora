import { notFound } from "next/navigation";
import { isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/require";
import { getAllMatches } from "@/lib/predictions";
import { BONUS_CATEGORIES, getOutcomes, getKnownTeams } from "@/lib/bonus";
import { collectMetrics, readSnapshots } from "@/lib/metrics";
import { Header } from "@/app/components/shell";
import { overrideMatchAction, setOutcomesAction, nudgeNamelessAction } from "./actions";

export default async function AdminPage() {
  // logged-out visitors get the login flow instead of a confusing 404
  const user = await requireUser("/admin");
  if (!user.isAdmin) notFound();

  const db = getDb();
  const matches = getAllMatches(db);
  const outcomes = getOutcomes(db);
  const teams = getKnownTeams(db);
  const now = collectMetrics(db);
  const nameless = db
    .select({ email: users.email })
    .from(users)
    .where(isNull(users.displayName))
    .all();
  // one snapshot per day (the midnight-UTC one) for the trend table
  const daily = readSnapshots(24 * 30).filter((m) => m.ts.includes("T00:"));
  const trend = [...daily.slice(-14)].reverse();

  return (
    <>
      <Header>
        <span className="pc-badge pc-badge--organiza">admin</span>
      </Header>
      <main className="page page--wide pc-flow">
        <h1 style={{ fontSize: 26, margin: 0 }}>Admin</h1>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>Métricas</h2>
          <table className="pc-board" style={{ boxShadow: "none" }}>
            <thead>
              <tr>
                <th>usuarios</th>
                <th className="pc-num">DAU</th>
                <th className="pc-num">WAU</th>
                <th className="pc-num">pollas</th>
                <th className="pc-num">miembros</th>
                <th className="pc-num">pronósticos</th>
                <th className="pc-num">recocha</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pc-num">{now.users}</td>
                <td className="pc-num">{now.dau}</td>
                <td className="pc-num">{now.wau}</td>
                <td className="pc-num">{now.groups}</td>
                <td className="pc-num">{now.memberships}</td>
                <td className="pc-num">{now.predictions}</td>
                <td className="pc-num">{now.questions}q/{now.answers}r</td>
              </tr>
            </tbody>
          </table>
          {trend.length > 0 && (
            <details className="pc-sheet">
              <summary>Tendencia diaria (medianoche UTC, {trend.length} días)</summary>
              <table>
                <tbody>
                  {trend.map((m) => (
                    <tr key={m.ts}>
                      <td>{m.ts.slice(0, 10)}</td>
                      <td>{m.users} u · {m.dau} dau · {m.groups} pollas · {m.predictions} pron.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          <p className="pc-hint" style={{ margin: 0 }}>
            Snapshots por hora en <code>metrics.jsonl</code> junto a la base de datos.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="pc-badge">{nameless.length} sin nombre</span>
            {nameless.length > 0 && (
              <form action={nudgeNamelessAction}>
                <button type="submit" className="pc-btn pc-btn--ghost pc-btn--sm">
                  Mandarles el correo de Tania
                </button>
              </form>
            )}
          </div>
          {nameless.length > 0 && (
            <details className="pc-sheet">
              <summary>Quiénes son</summary>
              <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: 20 }}>
                {nameless.map((u) => (
                  <li key={u.email} className="num" style={{ fontSize: "var(--text-sm)" }}>
                    {u.email}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

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
