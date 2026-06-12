import Link from "next/link";
import { Users, Target } from "lucide-react";
import { getDb } from "@/lib/db";
import { getGroupByInviteCode, getGroupMembers } from "@/lib/groups";
import { getCurrentUser } from "@/lib/auth/session";
import { PRESETS, parseScoringRules } from "@/lib/scoring/presets";
import { getLocale, t } from "@/lib/i18n";
import { HeroLang } from "@/app/components/shell";
import { joinGroupAction } from "./actions";

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const lo = await getLocale();
  const db = getDb();
  const group = getGroupByInviteCode(db, code);

  if (!group) {
    return (
      <main className="pc-hero-shell">
        <div className="pc-tricolor-rule" />
        <div className="pc-hero-shell__center">
          <div className="pc-empty pc-card pc-card--pad-lg">
            <span className="pc-empty__art">🤔</span>
            <span className="pc-empty__title">{t(lo, "join.badLinkTitle")}</span>
            <p className="pc-empty__body">
              {t(lo, "join.badLinkBody")}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  const members = getGroupMembers(db, group.id);
  const organizer = members.find((m) => m.role === "organizer");
  const rules = parseScoringRules(group.scoringRules);
  const preset = PRESETS[rules.preset];
  const shown = members.slice(0, 5);

  return (
    <main className="pc-hero-shell">
      <div className="pc-tricolor-rule" />
      <HeroLang />
      <div className="pc-hero-shell__center">
        <div
          className="pc-card pc-card--pad-lg"
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "center",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <span className="eyebrow">{t(lo, "join.eyebrow")}</span>
          <h1 style={{ margin: 0 }}>{group.name}</h1>
          {organizer?.displayName && (
            <p style={{ color: "var(--ink-soft)", margin: 0 }}>
              {t(lo, "join.organizes")} <b>{organizer.displayName}</b>
              {group.potNote && <> · {t(lo, "join.vaca")}: {group.potNote}</>}
            </p>
          )}

          {shown.length > 0 && (
            <div className="pc-avatar-row">
              {shown.map((m) => (
                <span key={m.userId} className="pc-avatar" title={m.displayName ?? ""}>
                  {initials(m.displayName)}
                </span>
              ))}
              {members.length > shown.length && (
                <span style={{ marginLeft: 16, color: "var(--ink-soft)", fontSize: 14, fontWeight: 600 }}>
                  {t(lo, "join.more", { n: members.length - shown.length })}
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <span className="pc-badge">
              <Users size={14} aria-hidden /> {t(lo, "join.players", { n: members.length })}
            </span>
            <span className="pc-badge">
              <Target size={14} aria-hidden /> {t(lo, "join.matches")}
            </span>
            <span className="pc-badge pc-badge--organiza">{preset.name}</span>
          </div>

          {user ? (
            <form action={joinGroupAction} style={{ width: "100%" }}>
              <input type="hidden" name="code" value={group.inviteCode} />
              <button type="submit" className="pc-btn pc-btn--sticker pc-btn--block pc-btn--lg">
                {t(lo, "join.cta")}
              </button>
            </form>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}
              className="pc-btn pc-btn--sticker pc-btn--block pc-btn--lg"
            >
              {t(lo, "join.cta")}
            </Link>
          )}
          <p className="pc-hint" style={{ margin: 0 }}>
            {user ? (
              <>{t(lo, "join.as")} <b>{user.email}</b>. </>
            ) : (
              <>{t(lo, "join.loginFirst")} </>
            )}
            {t(lo, "join.noMoney")}
          </p>
        </div>

        <details className="pc-card pc-sheet" open={lo !== "es"}>
          <summary>{t(lo, "explain.title")}</summary>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
            {t(lo, "explain.body")}
          </p>
        </details>
      </div>
    </main>
  );
}
