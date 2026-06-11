import Link from "next/link";
import { getDb } from "@/lib/db";
import { getGroupByInviteCode, getGroupMembers } from "@/lib/groups";
import { getCurrentUser } from "@/lib/auth/session";
import { joinGroupAction } from "./actions";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const db = getDb();
  const group = getGroupByInviteCode(db, code);

  if (!group) {
    return (
      <main>
        <h1>Enlace inválido</h1>
        <p>
          Este enlace de invitación no existe o fue regenerado. Pídele uno
          nuevo a quien organiza la polla.
        </p>
      </main>
    );
  }

  const user = await getCurrentUser();
  const members = getGroupMembers(db, group.id);

  return (
    <main>
      <h1>Te invitaron a “{group.name}”</h1>
      <p>{members.length} participante(s) hasta ahora.</p>
      {user ? (
        <form action={joinGroupAction}>
          <input type="hidden" name="code" value={group.inviteCode} />
          <button type="submit">Unirme</button>
        </form>
      ) : (
        <p>
          <Link href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}>
            Entra con tu correo
          </Link>{" "}
          para unirte.
        </p>
      )}
    </main>
  );
}
