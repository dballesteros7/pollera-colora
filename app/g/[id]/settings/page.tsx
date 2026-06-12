import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import { Header } from "@/app/components/shell";
import { getLocale, t } from "@/lib/i18n";
import { getViewerTz, formatDatetimeLocal } from "@/lib/viewer-tz";
import { setDisplayName } from "@/app/actions";
import {
  regenerateCodeAction,
  updateGroupNameAction,
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
  if (!access) notFound();
  const { group } = access;
  const organizer = access.role === "organizer";
  const lo = await getLocale();
  const tz = await getViewerTz();
  const members = getGroupMembers(getDb(), group.id);

  return (
    <>
      <Header />
      <main className="page pc-flow">
        <div>
          <Link href={`/g/${group.id}`} className="pc-btn pc-btn--quiet pc-btn--sm" style={{ marginLeft: -8 }}>
            <ArrowLeft size={16} aria-hidden /> {group.name}
          </Link>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "set.title")}</h1>
        </div>

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>{t(lo, "set.you")}</h2>
          <p className="pc-hint" style={{ margin: 0 }}>
            {t(lo, "set.youHint")}
          </p>
          <form action={setDisplayName} className="pc-page-actions">
            <input type="hidden" name="next" value={`/g/${group.id}/settings`} />
            <input
              className="pc-input"
              style={{ flex: 1 }}
              name="displayName"
              required
              minLength={2}
              maxLength={40}
              defaultValue={user.displayName ?? ""}
              placeholder={t(lo, "name.placeholder")}
            />
            <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
              {t(lo, "set.save")}
            </button>
          </form>
        </section>

        {organizer && (
          <>
            <section className="pc-card pc-card--pad-lg pc-flow">
              <h2 style={{ fontSize: 18, margin: 0 }}>{t(lo, "new.name")}</h2>
              <form action={updateGroupNameAction} className="pc-page-actions">
                <input type="hidden" name="groupId" value={group.id} />
                <input
                  className="pc-input"
                  style={{ flex: 1 }}
                  name="name"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={group.name}
                />
                <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
                  {t(lo, "set.save")}
                </button>
              </form>
            </section>

            <section className="pc-card pc-card--pad-lg pc-flow">
              <h2 style={{ fontSize: 18, margin: 0 }}>{t(lo, "set.invite")}</h2>
              <p style={{ margin: 0 }}>
                <code className="num">{process.env.APP_URL ?? ""}/join/{group.inviteCode}</code>
              </p>
              <form action={regenerateCodeAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className="pc-btn pc-btn--ghost pc-btn--sm">
                  {t(lo, "set.regen")}
                </button>
              </form>
            </section>

            <section className="pc-card pc-card--pad-lg pc-flow">
              <h2 style={{ fontSize: 18, margin: 0 }}>{t(lo, "set.vaca")}</h2>
              <form action={updatePotNoteAction} className="pc-page-actions">
                <input type="hidden" name="groupId" value={group.id} />
                <input
                  className="pc-input"
                  style={{ flex: 1 }}
                  name="potNote"
                  maxLength={200}
                  defaultValue={group.potNote ?? ""}
                  placeholder={t(lo, "set.vacaPh")}
                />
                <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
                  {t(lo, "set.save")}
                </button>
              </form>
            </section>

            <section className="pc-card pc-card--pad-lg pc-flow">
              <h2 style={{ fontSize: 18, margin: 0 }}>{t(lo, "set.bonusClose")}</h2>
              <p className="pc-hint" style={{ margin: 0 }}>
                {t(lo, "set.bonusCloseSub")}
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
                      ? formatDatetimeLocal(group.bonusLockAt, tz)
                      : ""
                  }
                />
                <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
                  {t(lo, "set.save")}
                </button>
              </form>
            </section>
          </>
        )}

        <section className="pc-card pc-card--pad-lg pc-flow">
          <h2 style={{ fontSize: 18, margin: 0 }}>{t(lo, "set.crew", { n: members.length })}</h2>
          <div className="pc-picklist" style={{ marginTop: 0 }}>
            {members.map((m) => (
              <span key={m.userId} className="pc-picklist__row">
                <span className="pc-avatar pc-avatar--sm">{(m.displayName ?? "?").slice(0, 2)}</span>
                {m.displayName ?? "(sin nombre)"}
                {m.role === "organizer" && (
                  <span className="pc-badge pc-badge--organiza">{t(lo, "set.organiza")}</span>
                )}
              </span>
            ))}
          </div>
        </section>

        <details className="pc-card pc-sheet">
          <summary>{t(lo, "explain.title")}</summary>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
            {t(lo, "explain.body")}
          </p>
        </details>
      </main>
    </>
  );
}
