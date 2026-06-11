import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  BONUS_CATEGORIES,
  bonusLocked,
  getUserBonusPicks,
  getGroupBonusPicks,
  getKnownTeams,
} from "@/lib/bonus";
import { PRESETS, parseScoringRules } from "@/lib/scoring/presets";
import { saveBonusPicksAction } from "./actions";

export default async function BonusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}/bonus`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, id);
  if (!access) notFound();
  const { group } = access;

  const now = new Date();
  const locked = bonusLocked(group, now);
  const rules = parseScoringRules(group.scoringRules);
  const points = PRESETS[rules.preset].bonusPoints;
  const mine = getUserBonusPicks(db, user.id, group.id);
  const teams = getKnownTeams(db);

  return (
    <main>
      <p>
        <Link href={`/g/${group.id}`}>← {group.name}</Link>
      </p>
      <h1>Pronósticos del torneo</h1>
      <p>
        {group.bonusLockAt
          ? locked
            ? "Cerrados."
            : `Cierran el ${group.bonusLockAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })} (hora colombiana).`
          : "Quien organiza aún no fija la fecha de cierre."}
      </p>

      {locked ? (
        <BonusReveal groupId={group.id} />
      ) : (
        <form action={saveBonusPicksAction}>
          <input type="hidden" name="groupId" value={group.id} />
          {BONUS_CATEGORIES.map((cat) => (
            <label key={cat.id}>
              {cat.label} ({points[cat.id]} pts)
              {cat.team ? (
                <select name={`pick_${cat.id}`} defaultValue={mine.get(cat.id) ?? ""}>
                  <option value="">— sin pronóstico —</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={`pick_${cat.id}`}
                  defaultValue={mine.get(cat.id) ?? ""}
                  placeholder="Nombre del jugador"
                  maxLength={60}
                />
              )}
            </label>
          ))}
          <button type="submit">Guardar pronósticos</button>
        </form>
      )}
    </main>
  );
}

async function BonusReveal({ groupId }: { groupId: string }) {
  const db = getDb();
  const picks = getGroupBonusPicks(db, groupId);
  const members = new Map(
    getGroupMembers(db, groupId).map((m) => [m.userId, m.displayName]),
  );
  const byCategory = new Map<string, typeof picks>();
  for (const p of picks) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }
  return (
    <div>
      {BONUS_CATEGORIES.map((cat) => (
        <section key={cat.id}>
          <h2>{cat.label}</h2>
          <ul>
            {(byCategory.get(cat.id) ?? []).map((p) => (
              <li key={`${p.userId}`}>
                {members.get(p.userId) ?? "(sin nombre)"}: {p.value}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
