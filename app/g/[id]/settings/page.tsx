import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  regenerateCodeAction,
  updatePotNoteAction,
  updateBonusLockAction,
} from "./actions";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}/settings`);
  const access = getGroupForMember(getDb(), user.id, id);
  if (!access || access.role !== "organizer") notFound();
  const { group } = access;

  return (
    <main>
      <p>
        <Link href={`/g/${group.id}`}>← {group.name}</Link>
      </p>
      <h1>Configuración</h1>

      <h2>Enlace de invitación</h2>
      <p>
        <code>/join/{group.inviteCode}</code>
      </p>
      <form action={regenerateCodeAction}>
        <input type="hidden" name="groupId" value={group.id} />
        <button type="submit">Regenerar enlace (invalida el anterior)</button>
      </form>

      <h2>Premio</h2>
      <form action={updatePotNoteAction}>
        <input type="hidden" name="groupId" value={group.id} />
        <input
          name="potNote"
          maxLength={200}
          defaultValue={group.potNote ?? ""}
        />
        <button type="submit">Guardar</button>
      </form>

      <h2>Cierre de pronósticos de torneo</h2>
      <p>
        Hasta cuándo se puede pronosticar campeón, goleador, etc. (vacío = sin
        definir).
      </p>
      <form action={updateBonusLockAction}>
        <input type="hidden" name="groupId" value={group.id} />
        <input
          type="datetime-local"
          name="bonusLockAt"
          defaultValue={
            group.bonusLockAt
              ? new Date(group.bonusLockAt).toISOString().slice(0, 16)
              : ""
          }
        />
        <button type="submit">Guardar</button>
      </form>
    </main>
  );
}
