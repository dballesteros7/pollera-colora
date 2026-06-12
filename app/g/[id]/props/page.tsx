import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  getGroupQuestions,
  getUserAnswers,
  getQuestionAnswers,
  getVoteTally,
  getUserVotes,
} from "@/lib/props";
import { getAllMatches, isLocked } from "@/lib/predictions";
import { getViewerTz, dateTimeFormatter } from "@/lib/viewer-tz";
import { getLocale, t, LOCALE_TAG } from "@/lib/i18n";
import { teamName } from "@/lib/teams";
import { Header, GroupTabs } from "@/app/components/shell";
import {
  proposeAction,
  voteAction,
  answerAction,
  resolveAction,
} from "./actions";

export default async function PropsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/g/${id}/props`);
  const db = getDb();
  const access = getGroupForMember(db, user.id, id);
  if (!access) notFound();
  const { group, role } = access;

  const now = new Date();
  const lo = await getLocale();
  const tz = await getViewerTz();
  const lockFormat = dateTimeFormatter(tz, LOCALE_TAG[lo]);
  const all = getGroupQuestions(db, group.id);
  const mine = getUserAnswers(db, group.id, user.id);
  const myVotes = getUserVotes(db, group.id, user.id);
  const upcoming = getAllMatches(db).filter((m) => !isLocked(m, now) && m.homeTeam);

  const proposed = all.filter((r) => r.q.status === "proposed");
  const open = all.filter((r) => r.q.status === "approved" && now < r.q.lockAt);
  const awaiting = all.filter((r) => r.q.status === "approved" && now >= r.q.lockAt);
  const resolved = all.filter((r) => r.q.status === "resolved");

  return (
    <>
      <Header>
        {open.length > 0 && (
          <span className="pc-badge pc-badge--open">
            <span className="pc-dot" />
            {t(lo, "r.nOpen", { n: open.length })}
          </span>
        )}
      </Header>
      <main className="page pc-flow" style={{ gap: "var(--space-6)" }}>
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "r.title")}</h1>
          <p className="pc-hint" style={{ margin: "4px 0 0" }}>
            {t(lo, "r.sub")}
          </p>
        </div>

        <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
          <h2 style={{ margin: "0 2px", fontSize: 18 }}>{t(lo, "r.open")}</h2>
          {open.length === 0 && (
            <div className="pc-card pc-empty">
              <span className="pc-empty__art">🎤</span>
              <span className="pc-empty__title">{t(lo, "r.emptyTitle")}</span>
              <p className="pc-empty__body">{t(lo, "r.emptyBody")}</p>
            </div>
          )}
          {open.map(({ q, proposerName }) => (
            <article key={q.id} className="pc-match" data-state="open">
              <div className="pc-match__head">
                <span className="pc-match__meta">
                  {t(lo, "r.proposedBy", { name: proposerName ?? "?", n: q.points })}
                </span>
                <span className="pc-match__time">{t(lo, "r.closes", { when: lockFormat.format(q.lockAt) })}</span>
              </div>
              <div className="pc-match__body pc-flow" style={{ gap: "var(--space-3)" }}>
                <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                <form action={answerAction} className="pc-page-actions">
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <AnswerInput
                    answerType={q.answerType}
                    options={(q.options as string[]) ?? []}
                    current={mine.get(q.id)}
                    lo={lo}
                  />
                  <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
                    {mine.has(q.id) ? t(lo, "r.change") : t(lo, "r.answer")}
                  </button>
                </form>
                {mine.has(q.id) && (
                  <p className="pc-saved" style={{ margin: 0 }}>
                    {t(lo, "r.yourAnswer", { v: mine.get(q.id)! })}
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>

        {awaiting.length > 0 && (
          <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>{t(lo, "r.waiting")}</h2>
            {awaiting.map(({ q }) => (
              <article key={q.id} className="pc-match" data-state="locked">
                <div className="pc-match__head">
                  <span className="pc-match__meta">{t(lo, "s.pts", { n: q.points })}</span>
                  <span className="pc-badge pc-badge--locked">{t(lo, "r.closed")}</span>
                </div>
                <div className="pc-match__body pc-flow" style={{ gap: "var(--space-3)" }}>
                  <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                  <AnswersList questionId={q.id} lo={lo} />
                  {role === "organizer" && (
                    <form action={resolveAction} className="pc-flow" style={{ gap: "var(--space-3)" }}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <div className="pc-field">
                        <label className="pc-label">{t(lo, "r.correct")}</label>
                        <ResolveInput
                          answerType={q.answerType}
                          options={(q.options as string[]) ?? []}
                          lo={lo}
                        />
                      </div>
                      {q.answerType === "number" && (
                        <label className="pc-option" style={{ padding: "var(--space-2) var(--space-3)" }}>
                          <input type="checkbox" name="resolutionMode" value="closest" />
                          <span className="pc-option__desc">
                            {t(lo, "r.closestOpt")}
                          </span>
                        </label>
                      )}
                      <button type="submit" className="pc-btn pc-btn--secondary pc-btn--sm">
                        {t(lo, "r.resolve")}
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        {resolved.length > 0 && (
          <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>{t(lo, "r.resolvedH")}</h2>
            {resolved.map(({ q }) => (
              <article key={q.id} className="pc-match" data-state="final">
                <div className="pc-match__head">
                  <span className="pc-match__meta">{t(lo, "s.pts", { n: q.points })}{q.resolutionMode === "closest" && <> · {t(lo, "r.closest")}</>}</span>
                  <span className="pc-badge pc-badge--final">{t(lo, "r.resolved")}</span>
                </div>
                <div className="pc-match__body pc-flow" style={{ gap: "var(--space-3)" }}>
                  <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                  <p style={{ margin: 0 }}>
                    {t(lo, "r.answerIs")} <b className="pc-pick">{q.correctValue}</b>
                  </p>
                  <AnswersList questionId={q.id} lo={lo} />
                </div>
              </article>
            ))}
          </section>
        )}

        {proposed.length > 0 && (
          <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>{t(lo, "r.toApprove")}</h2>
            {proposed.map(({ q, proposerName }) => {
              const tally = getVoteTally(db, q);
              const myVote = myVotes.get(q.id);
              return (
                <article key={q.id} className="pc-card pc-flow" style={{ gap: "var(--space-3)" }}>
                  <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                  <p className="pc-hint" style={{ margin: 0 }}>
                    {t(lo, "r.proposes", { name: proposerName ?? "?", type: q.answerType, when: lockFormat.format(q.lockAt) })}
                  </p>
                  <p className="pc-hint" style={{ margin: 0 }}>
                    <strong>{t(lo, "r.tally", { a: tally.approvals, r: tally.rejections, needed: tally.needed, eligible: tally.eligible })}</strong>
                    {" · "}
                    {t(lo, "r.quorumNote", { n: tally.eligible })}
                  </p>
                  <form action={voteAction} className="pc-page-actions">
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="questionId" value={q.id} />
                    <button
                      type="submit"
                      name="vote"
                      value="approve"
                      className={`pc-btn ${myVote === "approve" ? "pc-btn--accent" : "pc-btn--primary"} pc-btn--sm`}
                    >
                      {t(lo, "r.voteApprove")}
                      {myVote === "approve" && " ✓"}
                    </button>
                    <button
                      type="submit"
                      name="vote"
                      value="reject"
                      className={`pc-btn ${myVote === "reject" ? "pc-btn--danger" : "pc-btn--ghost"} pc-btn--sm`}
                    >
                      {t(lo, "r.voteReject")}
                      {myVote === "reject" && " ✓"}
                    </button>
                  </form>
                </article>
              );
            })}
          </section>
        )}

        <section className="pc-card pc-card--pad-lg pc-flow">
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>{t(lo, "r.proposeH")}</h2>
            <p className="pc-hint" style={{ margin: 0 }}>
              {t(lo, "r.proposeSub")}
            </p>
          </div>
          <form action={proposeAction} className="pc-flow">
            <input type="hidden" name="groupId" value={group.id} />
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-q">{t(lo, "r.q")}</label>
              <input id="prop-q" className="pc-input" name="question" required minLength={5} maxLength={200} />
            </div>
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-type">{t(lo, "r.type")}</label>
              <select id="prop-type" className="pc-input" name="answerType">
                <option value="number">{t(lo, "r.number")}</option>
                <option value="boolean">{t(lo, "r.yesno")}</option>
                <option value="choice">{t(lo, "r.choice")}</option>
              </select>
            </div>
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-options">
                {t(lo, "r.options")} <span className="pc-hint">{t(lo, "r.optionsHint")}</span>
              </label>
              <textarea id="prop-options" className="pc-input" name="options" rows={3} style={{ paddingTop: 10, minHeight: 80 }} />
            </div>
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-match">{t(lo, "r.match")}</label>
              <select id="prop-match" className="pc-input" name="matchId" defaultValue="">
                <option value="">{t(lo, "r.noMatch")}</option>
                {upcoming.map((m) => (
                  <option key={m.id} value={m.id}>
                    {teamName(m.homeTeam, lo)} vs {teamName(m.awayTeam, lo)} (
                    {m.kickoffUtc.toLocaleDateString("es-CO", { timeZone: tz, day: "numeric", month: "short" })})
                  </option>
                ))}
              </select>
            </div>
            <div className="pc-page-actions">
              <div className="pc-field" style={{ flex: 1 }}>
                <label className="pc-label" htmlFor="prop-lock">{t(lo, "r.manualClose")}</label>
                <input id="prop-lock" type="datetime-local" className="pc-input" name="lockAt" />
              </div>
              <div className="pc-field" style={{ width: 110 }}>
                <label className="pc-label" htmlFor="prop-points">{t(lo, "r.points")}</label>
                <input id="prop-points" type="number" className="pc-input" name="points" min={1} max={50} defaultValue={3} />
              </div>
            </div>
            <button type="submit" className="pc-btn pc-btn--accent pc-btn--block">
              {t(lo, "r.propose")}
            </button>
          </form>
        </section>
      </main>
      <GroupTabs groupId={group.id} active="props" />
    </>
  );
}

function AnswerInput({
  answerType,
  options,
  current,
  lo,
}: {
  answerType: string;
  options: string[];
  current?: string;
  lo: import("@/lib/i18n").Locale;
}) {
  if (answerType === "number") {
    return (
      <input
        type="number"
        name="value"
        className="pc-input"
        style={{ width: 110 }}
        required
        defaultValue={current ?? ""}
        aria-label={t(lo, "r.yourAnswerLabel")}
      />
    );
  }
  if (answerType === "boolean") {
    return (
      <span style={{ display: "inline-flex", gap: 8 }}>
        <label className="pc-option" style={{ padding: "var(--space-2) var(--space-3)" }}>
          <input type="radio" name="value" value="si" required defaultChecked={current === "si"} />
          <span>{t(lo, "r.yes")}</span>
        </label>
        <label className="pc-option" style={{ padding: "var(--space-2) var(--space-3)" }}>
          <input type="radio" name="value" value="no" defaultChecked={current === "no"} />
          <span>{t(lo, "r.no")}</span>
        </label>
      </span>
    );
  }
  return (
    <select name="value" className="pc-input" style={{ flex: 1, minWidth: 140 }} required defaultValue={current ?? ""}>
      <option value="" disabled>
        {t(lo, "r.choose")}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ResolveInput({
  answerType,
  options,
  lo,
}: {
  answerType: string;
  options: string[];
  lo: import("@/lib/i18n").Locale;
}) {
  if (answerType === "number") {
    return <input type="number" name="correctValue" className="pc-input" required />;
  }
  if (answerType === "boolean") {
    return (
      <select name="correctValue" className="pc-input" required>
        <option value="si">{t(lo, "r.yes")}</option>
        <option value="no">{t(lo, "r.no")}</option>
      </select>
    );
  }
  return (
    <select name="correctValue" className="pc-input" required>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

async function AnswersList({ questionId, lo }: { questionId: string; lo: import("@/lib/i18n").Locale }) {
  const answers = getQuestionAnswers(getDb(), questionId);
  if (answers.length === 0)
    return (
      <p className="pc-hint" style={{ margin: 0 }}>
        {t(lo, "r.nobody")}
      </p>
    );
  return (
    <div className="pc-picklist" style={{ marginTop: 0 }}>
      {answers.map((a) => (
        <span key={a.userId} className="pc-picklist__row">
          <span className="pc-avatar pc-avatar--sm">{(a.displayName ?? "?").slice(0, 2)}</span>
          {a.displayName ?? "(sin nombre)"}
          <span className="pc-pick">{a.value}</span>
        </span>
      ))}
    </div>
  );
}
