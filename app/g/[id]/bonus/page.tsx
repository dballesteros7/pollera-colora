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
import { getViewerTz, dateTimeFormatter } from "@/lib/viewer-tz";
import { Header, GroupTabs } from "@/app/components/shell";
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
  const deadlineFormat = dateTimeFormatter(await getViewerTz());
  const locked = bonusLocked(group, now);
  const rules = parseScoringRules(group.scoringRules);
  const points = PRESETS[rules.preset].bonusPoints;
  const mine = getUserBonusPicks(db, user.id, group.id);
  const teams = getKnownTeams(db);

  return (
    <>
      <Header>
        <span className={`pc-badge ${locked ? "pc-badge--locked" : "pc-badge--open"}`}>
          {!locked && <span className="pc-dot" />}
          {locked ? "cerrado" : "abierto"}
        </span>
      </Header>
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>Bonus del torneo</h1>
          <p className="pc-hint" style={{ margin: "4px 0 0" }}>
            {group.bonusLockAt
              ? locked
                ? "Ya cerraron — estos son los del parche."
                : `Cierran el ${deadlineFormat.format(group.bonusLockAt)} (su hora).`
              : "Quien organiza todavía no ha fijado el cierre."}
          </p>
        </div>

        {locked ? (
          <BonusReveal groupId={group.id} />
        ) : (
          <form action={saveBonusPicksAction} className="pc-card pc-card--pad-lg pc-flow">
            <input type="hidden" name="groupId" value={group.id} />
            {BONUS_CATEGORIES.map((cat) => (
              <div className="pc-field" key={cat.id}>
                <label className="pc-label" htmlFor={`pick_${cat.id}`}>
                  {cat.label}{" "}
                  <span className="pc-badge pc-badge--points">+{points[cat.id]} pts</span>
                </label>
                {cat.team ? (
                  <select
                    id={`pick_${cat.id}`}
                    name={`pick_${cat.id}`}
                    className="pc-input"
                    defaultValue={mine.get(cat.id) ?? ""}
                  >
                    <option value="">— sin pronóstico —</option>
                    {teams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`pick_${cat.id}`}
                    name={`pick_${cat.id}`}
                    className="pc-input"
                    defaultValue={mine.get(cat.id) ?? ""}
                    placeholder="Nombre del jugador"
                    maxLength={60}
                  />
                )}
              </div>
            ))}
            <button type="submit" className="pc-btn pc-btn--primary pc-btn--block">
              Guardar pronósticos
            </button>
            <p className="pc-hint" style={{ textAlign: "center", margin: 0 }}>
              Puede cambiarlos hasta el cierre.
            </p>
          </form>
        )}
      </main>
      <GroupTabs groupId={group.id} active="bonus" />
    </>
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
    <div className="pc-flow" style={{ gap: "var(--gap-card)" }}>
      {BONUS_CATEGORIES.map((cat) => {
        const rows = byCategory.get(cat.id) ?? [];
        return (
          <section key={cat.id} className="pc-card">
            <h3 style={{ fontSize: 16, marginBottom: "var(--space-2)" }}>{cat.label}</h3>
            {rows.length === 0 ? (
              <p className="pc-hint" style={{ margin: 0 }}>
                Nadie se le midió.
              </p>
            ) : (
              <div className="pc-picklist" style={{ marginTop: 0 }}>
                {rows.map((p) => (
                  <span key={p.userId} className="pc-picklist__row">
                    <span className="pc-avatar pc-avatar--sm">
                      {(members.get(p.userId) ?? "?").slice(0, 2)}
                    </span>
                    {members.get(p.userId) ?? "(sin nombre)"}
                    <span className="pc-pick">{p.value}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
