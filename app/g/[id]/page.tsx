import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers } from "@/lib/groups";
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
  const members = getGroupMembers(db, group.id);
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];

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
      </p>

      {/* Phase 4: leaderboard goes here */}
      <h2>Participantes ({members.length})</h2>
      <ul>
        {members.map((m) => (
          <li key={m.userId}>
            {m.displayName ?? "(sin nombre)"}
            {m.role === "organizer" && " — organiza"}
          </li>
        ))}
      </ul>

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
