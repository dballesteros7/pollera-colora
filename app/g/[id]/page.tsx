import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { getLeaderboard } from "@/lib/leaderboard";
import { requireUser } from "@/lib/auth/require";
import { PRESETS, parseScoringRules } from "@/lib/scoring/presets";

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
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];
  const board = getLeaderboard(db, group.id);

  return (
    <main>
      <p>
        <Link href="/">← Mis pollas</Link>
      </p>
      <h1>{group.name}</h1>
      <p>
        Puntos: <strong>{preset.name}</strong>
        {rules.unicoAcertado && " · único acertado activo"}
      </p>
      {group.potNote && <p>Premio: {group.potNote}</p>}

      <p>
        <Link href={`/g/${group.id}/fixtures`}>Partidos y pronósticos →</Link>
        {" · "}
        <Link href={`/g/${group.id}/bonus`}>Campeón, goleador y más →</Link>
      </p>

      <h2>Tabla</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Quién</th>
            <th>Puntos</th>
            <th>Exactos</th>
            <th>Resultados</th>
          </tr>
        </thead>
        <tbody>
          {board.map((row, i) => (
            <tr key={row.userId}>
              <td>{i + 1}</td>
              <td>
                {row.displayName ?? "(sin nombre)"}
                {row.userId === user.id && " ← tú"}
              </td>
              <td>{row.total}</td>
              <td>{row.exactCount}</td>
              <td>{row.resultCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Invitar</h2>
      <p>
        Comparte este enlace: <code>/join/{group.inviteCode}</code>
      </p>

      {role === "organizer" && (
        <p>
          <Link href={`/g/${group.id}/settings`}>Configuración</Link>
        </p>
      )}
    </main>
  );
}
