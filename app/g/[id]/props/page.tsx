import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/auth/require";
import {
  getGroupQuestions,
  getUserAnswers,
  getQuestionAnswers,
} from "@/lib/props";
import { getAllMatches, isLocked } from "@/lib/predictions";
import { getViewerTz, dateTimeFormatter } from "@/lib/viewer-tz";
import { Header, GroupTabs } from "@/app/components/shell";
import {
  proposeAction,
  reviewAction,
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
  const tz = await getViewerTz();
  const lockFormat = dateTimeFormatter(tz);
  const all = getGroupQuestions(db, group.id);
  const mine = getUserAnswers(db, group.id, user.id);
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
            {open.length} abiertas
          </span>
        )}
      </Header>
      <main className="page pc-flow" style={{ gap: "var(--space-6)" }}>
        <div>
          <span className="eyebrow">{group.name}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>La Recocha</h1>
          <p className="pc-hint" style={{ margin: "4px 0 0" }}>
            Las preguntas las propone el grupo y las resuelve quien organiza.
          </p>
        </div>

        <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
          <h2 style={{ margin: "0 2px", fontSize: 18 }}>Abiertas</h2>
          {open.length === 0 && (
            <div className="pc-card pc-empty">
              <span className="pc-empty__art">🎤</span>
              <span className="pc-empty__title">Nada abierto por ahora</span>
              <p className="pc-empty__body">Proponga una pregunta abajo — la que sea.</p>
            </div>
          )}
          {open.map(({ q, proposerName }) => (
            <article key={q.id} className="pc-match" data-state="open">
              <div className="pc-match__head">
                <span className="pc-match__meta">
                  propuso {proposerName ?? "alguien"} · {q.points} pts
                </span>
                <span className="pc-match__time">cierra {lockFormat.format(q.lockAt)}</span>
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
                  />
                  <button type="submit" className="pc-btn pc-btn--primary pc-btn--sm">
                    {mine.has(q.id) ? "Cambiar" : "Responder"}
                  </button>
                </form>
                {mine.has(q.id) && (
                  <p className="pc-saved" style={{ margin: 0 }}>
                    Su respuesta: {mine.get(q.id)} — puede cambiarla hasta el cierre.
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>

        {awaiting.length > 0 && (
          <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>Cerradas, esperando resultado</h2>
            {awaiting.map(({ q }) => (
              <article key={q.id} className="pc-match" data-state="locked">
                <div className="pc-match__head">
                  <span className="pc-match__meta">{q.points} pts</span>
                  <span className="pc-badge pc-badge--locked">cerrada</span>
                </div>
                <div className="pc-match__body pc-flow" style={{ gap: "var(--space-3)" }}>
                  <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                  <AnswersList questionId={q.id} />
                  {role === "organizer" && (
                    <form action={resolveAction} className="pc-flow" style={{ gap: "var(--space-3)" }}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <div className="pc-field">
                        <label className="pc-label">Respuesta correcta</label>
                        <ResolveInput
                          answerType={q.answerType}
                          options={(q.options as string[]) ?? []}
                        />
                      </div>
                      {q.answerType === "number" && (
                        <label className="pc-option" style={{ padding: "var(--space-2) var(--space-3)" }}>
                          <input type="checkbox" name="resolutionMode" value="closest" />
                          <span className="pc-option__desc">
                            Gana quien más se acerque (en vez de exacto)
                          </span>
                        </label>
                      )}
                      <button type="submit" className="pc-btn pc-btn--secondary pc-btn--sm">
                        Resolver
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
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>Resueltas</h2>
            {resolved.map(({ q }) => (
              <article key={q.id} className="pc-match" data-state="final">
                <div className="pc-match__head">
                  <span className="pc-match__meta">{q.points} pts{q.resolutionMode === "closest" && " · al más cercano"}</span>
                  <span className="pc-badge pc-badge--final">resuelta</span>
                </div>
                <div className="pc-match__body pc-flow" style={{ gap: "var(--space-3)" }}>
                  <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                  <p style={{ margin: 0 }}>
                    Respuesta: <b className="pc-pick">{q.correctValue}</b>
                  </p>
                  <AnswersList questionId={q.id} />
                </div>
              </article>
            ))}
          </section>
        )}

        {role === "organizer" && proposed.length > 0 && (
          <section className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            <h2 style={{ margin: "0 2px", fontSize: 18 }}>Por aprobar</h2>
            {proposed.map(({ q, proposerName }) => (
              <article key={q.id} className="pc-card pc-flow" style={{ gap: "var(--space-3)" }}>
                <h3 style={{ fontSize: 17, margin: 0 }}>{q.question}</h3>
                <p className="pc-hint" style={{ margin: 0 }}>
                  Propone {proposerName ?? "alguien"} · tipo {q.answerType} · cierra{" "}
                  {lockFormat.format(q.lockAt)}
                </p>
                <form action={reviewAction} className="pc-page-actions">
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <input
                    type="number"
                    name="points"
                    className="pc-input"
                    style={{ width: 90 }}
                    min={1}
                    max={50}
                    defaultValue={q.points}
                    aria-label="Puntos"
                  />
                  <button type="submit" name="decision" value="approved" className="pc-btn pc-btn--primary pc-btn--sm">
                    Aprobar
                  </button>
                  <button type="submit" name="decision" value="rejected" className="pc-btn pc-btn--ghost pc-btn--sm">
                    Rechazar
                  </button>
                </form>
              </article>
            ))}
          </section>
        )}
        {role !== "organizer" && proposed.length > 0 && (
          <p className="pc-hint">
            {proposed.length} pregunta(s) esperando a quien organiza.
          </p>
        )}

        <section className="pc-card pc-card--pad-lg pc-flow">
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Proponga una pregunta</h2>
            <p className="pc-hint" style={{ margin: 0 }}>
              La que sea: “¿cuántos bailes de salsa choke?”, “¿llora el
              comentarista si gana Colombia?”
            </p>
          </div>
          <form action={proposeAction} className="pc-flow">
            <input type="hidden" name="groupId" value={group.id} />
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-q">Pregunta</label>
              <input id="prop-q" className="pc-input" name="question" required minLength={5} maxLength={200} />
            </div>
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-type">Tipo de respuesta</label>
              <select id="prop-type" className="pc-input" name="answerType">
                <option value="number">Número</option>
                <option value="boolean">Sí / No</option>
                <option value="choice">Opciones</option>
              </select>
            </div>
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-options">
                Opciones <span className="pc-hint">(una por línea, solo para tipo “Opciones”)</span>
              </label>
              <textarea id="prop-options" className="pc-input" name="options" rows={3} style={{ paddingTop: 10, minHeight: 80 }} />
            </div>
            <div className="pc-field">
              <label className="pc-label" htmlFor="prop-match">Partido (opcional — cierra con el pitazo)</label>
              <select id="prop-match" className="pc-input" name="matchId" defaultValue="">
                <option value="">Sin partido — cierre manual</option>
                {upcoming.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.homeTeam} vs {m.awayTeam} (
                    {m.kickoffUtc.toLocaleDateString("es-CO", { timeZone: tz, day: "numeric", month: "short" })})
                  </option>
                ))}
              </select>
            </div>
            <div className="pc-page-actions">
              <div className="pc-field" style={{ flex: 1 }}>
                <label className="pc-label" htmlFor="prop-lock">Cierre manual</label>
                <input id="prop-lock" type="datetime-local" className="pc-input" name="lockAt" />
              </div>
              <div className="pc-field" style={{ width: 110 }}>
                <label className="pc-label" htmlFor="prop-points">Puntos</label>
                <input id="prop-points" type="number" className="pc-input" name="points" min={1} max={50} defaultValue={3} />
              </div>
            </div>
            <button type="submit" className="pc-btn pc-btn--accent pc-btn--block">
              Mandársela al parche
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
}: {
  answerType: string;
  options: string[];
  current?: string;
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
        aria-label="Su respuesta"
      />
    );
  }
  if (answerType === "boolean") {
    return (
      <span style={{ display: "inline-flex", gap: 8 }}>
        <label className="pc-option" style={{ padding: "var(--space-2) var(--space-3)" }}>
          <input type="radio" name="value" value="si" required defaultChecked={current === "si"} />
          <span>Sí</span>
        </label>
        <label className="pc-option" style={{ padding: "var(--space-2) var(--space-3)" }}>
          <input type="radio" name="value" value="no" defaultChecked={current === "no"} />
          <span>No</span>
        </label>
      </span>
    );
  }
  return (
    <select name="value" className="pc-input" style={{ flex: 1, minWidth: 140 }} required defaultValue={current ?? ""}>
      <option value="" disabled>
        Elija…
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
}: {
  answerType: string;
  options: string[];
}) {
  if (answerType === "number") {
    return <input type="number" name="correctValue" className="pc-input" required />;
  }
  if (answerType === "boolean") {
    return (
      <select name="correctValue" className="pc-input" required>
        <option value="si">Sí</option>
        <option value="no">No</option>
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

async function AnswersList({ questionId }: { questionId: string }) {
  const answers = getQuestionAnswers(getDb(), questionId);
  if (answers.length === 0)
    return (
      <p className="pc-hint" style={{ margin: 0 }}>
        Nadie respondió.
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
