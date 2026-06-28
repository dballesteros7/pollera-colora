import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember, getGroupMembers } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  BONUS_CATEGORIES,
  bonusLocked,
  bonusDeadline,
  getUserBonusPicks,
  getGroupBonusPicks,
  getKnownTeams,
} from "@/lib/bonus";
import { PRESETS, parseScoringRules } from "@/lib/scoring/presets";
import { getViewerTz, dateTimeFormatter } from "@/lib/viewer-tz";
import { getLocale, t, LOCALE_TAG, type Locale } from "@/lib/i18n";
import { teamName } from "@/lib/teams";
import { Header, GroupTabs } from "@/app/components/shell";
import { FeedbackForm, PendingButton } from "@/app/components/feedback-form";
import { saveBonusPicksAction } from "./actions";

const CAT_KEY: Record<string, string> = {
  champion: "champion",
  runner_up: "runnerUp",
  third: "third",
  top_scorer: "topScorer",
  best_gk: "bestGk",
};

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
  if (access.group.isSuper) redirect(`/g/${id}`);
  const { group } = access;

  const now = new Date();
  const lo = await getLocale();
  const deadlineFormat = dateTimeFormatter(await getViewerTz(), LOCALE_TAG[lo]);
  const locked = bonusLocked(group, now);
  const deadline = bonusDeadline(group);
  const rules = parseScoringRules(group.scoringRules);
  const points = PRESETS[rules.preset].bonusPoints;
  const mine = getUserBonusPicks(db, user.id, group.id);
  const teams = getKnownTeams(db);

  return (
    <>
      <Header>
        <span className={`pc-badge ${locked ? "pc-badge--locked" : "pc-badge--open"}`}>
          {!locked && <span className="pc-dot" />}
          {locked ? t(lo, "badge.locked") : t(lo, "badge.open")}
        </span>
      </Header>
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "b.title")}</h1>
        </div>

        <div
          className="pc-card"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderColor: locked ? "var(--line-strong)" : "var(--amarillo-deep)",
            background: locked
              ? undefined
              : "color-mix(in srgb, var(--amarillo) 14%, transparent)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>
            {locked
              ? t(lo, "b.closedGroupPhase")
              : t(lo, "b.closesGroupPhase", { when: deadlineFormat.format(deadline) })}
          </p>
        </div>

        {locked ? (
          <BonusReveal groupId={group.id} lo={lo} />
        ) : (
          <FeedbackForm
            action={saveBonusPicksAction}
            doneMsg={t(lo, "ui.saved")}
            errMsg={t(lo, "ui.lockedErr")}
            className="pc-card pc-card--pad-lg pc-flow"
          >
            <input type="hidden" name="groupId" value={group.id} />
            {BONUS_CATEGORIES.map((cat) => (
              <div className="pc-field" key={cat.id}>
                <label className="pc-label" htmlFor={`pick_${cat.id}`}>
                  {t(lo, `b.${CAT_KEY[cat.id]}`)}{" "}
                  <span className="pc-badge pc-badge--points">+{t(lo, "s.pts", { n: points[cat.id] })}</span>
                </label>
                {cat.team ? (
                  <select
                    id={`pick_${cat.id}`}
                    name={`pick_${cat.id}`}
                    className="pc-input"
                    defaultValue={mine.get(cat.id) ?? ""}
                  >
                    <option value="">{t(lo, "b.none")}</option>
                    {teams.map((team) => (
                      <option key={team} value={team}>
                        {teamName(team, lo)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`pick_${cat.id}`}
                    name={`pick_${cat.id}`}
                    className="pc-input"
                    defaultValue={mine.get(cat.id) ?? ""}
                    placeholder={t(lo, "b.playerPh")}
                    maxLength={60}
                  />
                )}
              </div>
            ))}
            <PendingButton
              label={t(lo, "b.save")}
              pendingLabel={t(lo, "ui.saving")}
              className="pc-btn pc-btn--primary pc-btn--block"
            />
            <p className="pc-hint" style={{ textAlign: "center", margin: 0 }}>
              {t(lo, "b.editable")}
            </p>
          </FeedbackForm>
        )}
      </main>
      <GroupTabs groupId={group.id} active="bonus" />
    </>
  );
}

async function BonusReveal({ groupId, lo }: { groupId: string; lo: Locale }) {
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
            <h3 style={{ fontSize: 16, marginBottom: "var(--space-2)" }}>{t(lo, `b.${CAT_KEY[cat.id]}`)}</h3>
            {rows.length === 0 ? (
              <p className="pc-hint" style={{ margin: 0 }}>
                {t(lo, "b.nobody")}
              </p>
            ) : (
              <div className="pc-picklist" style={{ marginTop: 0 }}>
                {rows.map((p) => (
                  <span key={p.userId} className="pc-picklist__row">
                    <span className="pc-avatar pc-avatar--sm">
                      {(members.get(p.userId) ?? "?").slice(0, 2)}
                    </span>
                    {members.get(p.userId) ?? "(sin nombre)"}
                    <span className="pc-pick">{teamName(p.value, lo) ?? p.value}</span>
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
