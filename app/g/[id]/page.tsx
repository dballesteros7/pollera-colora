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
} from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers } from "@/lib/groups";
import { getLeaderboard } from "@/lib/leaderboard";
import { requireUser } from "@/lib/auth/require";
import { PRESETS, parseScoringRules } from "@/lib/scoring/presets";
import { getAllMatches, isPredictable, getUserPredictions } from "@/lib/predictions";
import { getGroupQuestions, getUserAnswers } from "@/lib/props";
import { bonusLocked } from "@/lib/bonus";
import { Header, GroupTabs } from "@/app/components/shell";

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

  const { group, role } = access;
  const now = new Date();
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];
  const board = getLeaderboard(db, group.id);
  const organizer = getGroupMembers(db, group.id).find((m) => m.role === "organizer");

  const matches = getAllMatches(db);
  const myPredictions = getUserPredictions(db, user.id, group.id);
  const openUnpredicted = matches.filter(
    (m) => isPredictable(m, now) && !myPredictions.has(m.id),
  ).length;

  const questions = getGroupQuestions(db, group.id);
  const myAnswers = getUserAnswers(db, group.id, user.id);
  const openProps = questions.filter(
    (r) => r.q.status === "approved" && now < r.q.lockAt && !myAnswers.has(r.q.id),
  ).length;

  const bonusClosed = bonusLocked(group, now);

  return (
    <>
      <Header>
        {role === "organizer" && (
          <Link href={`/g/${group.id}/settings`} className="pc-iconbtn" aria-label="Configuración">
            <Settings size={20} aria-hidden />
          </Link>
        )}
      </Header>
      <main className="page pc-flow">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">{group.name}</span>
            <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>Tabla de posiciones</h1>
          </div>
          {organizer?.displayName && (
            <span className="pc-badge pc-badge--organiza">
              <Crown size={14} aria-hidden /> {organizer.displayName.split(" ")[0]} organiza
            </span>
          )}
        </div>

        {board.length <= 1 && board.every((r) => r.total === 0) ? (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">🏆</span>
            <span className="pc-empty__title">La tabla arranca en ceros</span>
            <p className="pc-empty__body">
              Invite al parche y metan sus pronósticos antes del pitazo.
            </p>
          </div>
        ) : (
          <table className="pc-board">
            <thead>
              <tr>
                <th scope="col" aria-label="Puesto">#</th>
                <th scope="col">Quién</th>
                <th scope="col" className="pc-num">Pts</th>
                <th scope="col" className="pc-num">Exactos</th>
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
                    </span>
                  </td>
                  <td className="pc-num pc-points">{row.total}</td>
                  <td className="pc-num pc-exact">{row.exactCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: "var(--ink-soft)" }}>
          <span className="pc-badge">{preset.name}{rules.unicoAcertado ? " · único acertado" : ""}</span>
          {group.potNote && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Trophy size={15} style={{ color: "var(--amarillo-deep)" }} aria-hidden /> Vaca: {group.potNote}
            </span>
          )}
        </div>

        <div className="pc-flow" style={{ gap: "var(--gap-card)" }}>
          <Link href={`/g/${group.id}/fixtures`} className="pc-card pc-quicklink">
            <span className="pc-quicklink__icon"><CalendarDays size={22} aria-hidden /></span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">Pronosticar partidos</span>
              <span className="pc-quicklink__sub">Los 104 del Mundial, día a día</span>
            </span>
            {openUnpredicted > 0 && (
              <span className="pc-badge pc-badge--open"><span className="pc-dot" />{openUnpredicted} sin marcar</span>
            )}
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
          <Link href={`/g/${group.id}/props`} className="pc-card pc-quicklink">
            <span className="pc-quicklink__icon"><ListChecks size={22} aria-hidden /></span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">Preguntas del parche</span>
              <span className="pc-quicklink__sub">Las preguntas que propone el grupo</span>
            </span>
            {openProps > 0 && <span className="pc-badge">{openProps}</span>}
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
          <Link href={`/g/${group.id}/bonus`} className="pc-card pc-quicklink">
            <span className="pc-quicklink__icon"><Star size={22} aria-hidden /></span>
            <span className="pc-quicklink__text">
              <span className="pc-quicklink__label">Bonus: campeón y goleador</span>
              <span className="pc-quicklink__sub">
                {bonusClosed
                  ? "Cerrados — mire los del parche"
                  : group.bonusLockAt
                    ? "Cierran pronto, ¡pilas!"
                    : "Abiertos"}
              </span>
            </span>
            {bonusClosed ? (
              <span className="pc-badge pc-badge--locked">cerrado</span>
            ) : (
              <span className="pc-badge pc-badge--open"><span className="pc-dot" />abierto</span>
            )}
            <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
          </Link>
        </div>

        <p className="pc-hint" style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <LinkIcon size={14} aria-hidden /> Invite con este enlace:{" "}
          <code className="num">{process.env.APP_URL ?? ""}/join/{group.inviteCode}</code>
        </p>
      </main>
      <GroupTabs groupId={group.id} active="home" />
    </>
  );
}
