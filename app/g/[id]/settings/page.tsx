import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import { Header } from "@/app/components/shell";
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
  const members = getGroupMembers(getDb(), group.id);

  return (
    <>
      <Header />
      <main className="page pc-flow">
        <div>
          <Link href={`/g/${group.id}`} className="pc-btn pc-btn--quiet pc-btn--sm" style={{ marginLeft: -8 }}>
            <ArrowLeft size={16} aria-hidden /> {group.name}
          </Link>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>Configuración</h1>
        </div>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>Enlace de invitación</h2>
          <p style={{ margin: 0 }}>
            <code className="num">/join/{group.inviteCode}</code>
          </p>
          <form action={regenerateCodeAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <button type="submit" className="pc-btn pc-btn--ghost pc-btn--sm">
              Regenerar enlace (invalida el anterior)
            </button>
          </form>
        </section>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>Pozo</h2>
          <form action={updatePotNoteAction} className="pc-page-actions">
            <input type="hidden" name="groupId" value={group.id} />
            <input
              className="pc-input"
              style={{ flex: 1 }}
              name="potNote"
              maxLength={200}
              defaultValue={group.potNote ?? ""}
              placeholder="$50.000 entrada · 70/20/10"
            />
            <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
              Guardar
            </button>
          </form>
        </section>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>Cierre de los bonus</h2>
          <p className="pc-hint" style={{ margin: 0 }}>
            Hasta cuándo se puede pronosticar campeón, goleador, etc.
          </p>
          <form action={updateBonusLockAction} className="pc-page-actions">
            <input type="hidden" name="groupId" value={group.id} />
            <input
              type="datetime-local"
              className="pc-input"
              style={{ flex: 1 }}
              name="bonusLockAt"
              defaultValue={
                group.bonusLockAt
                  ? new Date(group.bonusLockAt).toISOString().slice(0, 16)
                  : ""
              }
            />
            <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
              Guardar
            </button>
          </form>
        </section>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>El parche ({members.length})</h2>
          <div className="pc-picklist" style={{ marginTop: 0 }}>
            {members.map((m) => (
              <span key={m.userId} className="pc-picklist__row">
                <span className="pc-avatar pc-avatar--sm">{(m.displayName ?? "?").slice(0, 2)}</span>
                {m.displayName ?? "(sin nombre)"}
                {m.role === "organizer" && (
                  <span className="pc-badge pc-badge--organiza">organiza</span>
                )}
              </span>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
