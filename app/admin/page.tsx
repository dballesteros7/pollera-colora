import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllMatches } from "@/lib/predictions";
import { BONUS_CATEGORIES, getOutcomes, getKnownTeams } from "@/lib/bonus";
import { overrideMatchAction, setOutcomesAction } from "./actions";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  const db = getDb();
  const matches = getAllMatches(db);
  const outcomes = getOutcomes(db);
  const teams = getKnownTeams(db);

  return (
    <main>
      <h1>Admin</h1>

      <h2>Resultados del torneo</h2>
      <form action={setOutcomesAction}>
        {BONUS_CATEGORIES.map((cat) => (
          <label key={cat.id}>
            {cat.label}
            {cat.team ? (
              <select
                name={`outcome_${cat.id}`}
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
                name={`outcome_${cat.id}`}
                defaultValue={outcomes.get(cat.id) ?? ""}
              />
            )}
          </label>
        ))}
        <button type="submit">Guardar resultados</button>
      </form>

      <h2>Partidos ({matches.length})</h2>
      {matches.map((m) => (
        <article key={m.id}>
          <h3>
            #{m.id} {m.homeTeam ?? "?"} vs {m.awayTeam ?? "?"} · {m.status}
            {m.manualOverride && " · OVERRIDE"}
          </h3>
          <p>
            {m.kickoffUtc.toISOString()} · 90&apos;: {m.regHome ?? "–"}-
            {m.regAway ?? "–"} · final: {m.finalHome ?? "–"}-{m.finalAway ?? "–"}
          </p>
          <form action={overrideMatchAction}>
            <input type="hidden" name="matchId" value={m.id} />
            <input type="number" name="regHome" placeholder="90' local" defaultValue={m.regHome ?? ""} />
            <input type="number" name="regAway" placeholder="90' visita" defaultValue={m.regAway ?? ""} />
            <input type="number" name="finalHome" placeholder="final local" defaultValue={m.finalHome ?? ""} />
            <input type="number" name="finalAway" placeholder="final visita" defaultValue={m.finalAway ?? ""} />
            <label>
              <input type="checkbox" name="clear" />
              soltar override (vuelve al API)
            </label>
            <button type="submit">Aplicar</button>
          </form>
        </article>
      ))}
    </main>
  );
}
