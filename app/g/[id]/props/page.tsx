import Link from "next/link";
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
  const all = getGroupQuestions(db, group.id);
  const mine = getUserAnswers(db, group.id, user.id);
  const upcoming = getAllMatches(db).filter((m) => !isLocked(m, now));

  const proposed = all.filter((r) => r.q.status === "proposed");
  const open = all.filter(
    (r) => r.q.status === "approved" && now < r.q.lockAt,
  );
  const awaitingResolution = all.filter(
    (r) => r.q.status === "approved" && now >= r.q.lockAt,
  );
  const resolved = all.filter((r) => r.q.status === "resolved");

  return (
    <main>
      <p>
        <Link href={`/g/${group.id}`}>← {group.name}</Link>
      </p>
      <h1>Preguntas del parche</h1>

      <h2>Abiertas</h2>
      {open.length === 0 && <p>No hay preguntas abiertas.</p>}
      {open.map(({ q, proposerName }) => (
        <article key={q.id}>
          <h3>
            {q.question} ({q.points} pts)
          </h3>
          <p>
            Propuso {proposerName ?? "alguien"} · cierra{" "}
            {q.lockAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}
          </p>
          <form action={answerAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="questionId" value={q.id} />
            <AnswerInput
              answerType={q.answerType}
              options={(q.options as string[]) ?? []}
              current={mine.get(q.id)}
            />
            <button type="submit">
              {mine.has(q.id) ? "Cambiar respuesta" : "Responder"}
            </button>
          </form>
        </article>
      ))}

      {awaitingResolution.length > 0 && (
        <>
          <h2>Cerradas, esperando resultado</h2>
          {awaitingResolution.map(({ q }) => (
            <article key={q.id}>
              <h3>
                {q.question} ({q.points} pts)
              </h3>
              <AnswersList questionId={q.id} />
              {role === "organizer" && (
                <form action={resolveAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <label>
                    Respuesta correcta
                    <ResolveInput
                      answerType={q.answerType}
                      options={(q.options as string[]) ?? []}
                    />
                  </label>
                  {q.answerType === "number" && (
                    <label>
                      <input type="checkbox" name="resolutionMode" value="closest" />
                      Gana quien más se acerque (en vez de exacto)
                    </label>
                  )}
                  <button type="submit">Resolver</button>
                </form>
              )}
            </article>
          ))}
        </>
      )}

      {resolved.length > 0 && (
        <>
          <h2>Resueltas</h2>
          {resolved.map(({ q }) => (
            <article key={q.id}>
              <h3>{q.question}</h3>
              <p>
                Respuesta: <strong>{q.correctValue}</strong> ({q.points} pts
                {q.resolutionMode === "closest" && ", al más cercano"})
              </p>
              <AnswersList questionId={q.id} />
            </article>
          ))}
        </>
      )}

      {role === "organizer" && proposed.length > 0 && (
        <>
          <h2>Por aprobar</h2>
          {proposed.map(({ q, proposerName }) => (
            <article key={q.id}>
              <h3>{q.question}</h3>
              <p>
                Propone {proposerName ?? "alguien"} · tipo {q.answerType} ·
                cierra{" "}
                {q.lockAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}
              </p>
              <form action={reviewAction}>
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="questionId" value={q.id} />
                <label>
                  Puntos
                  <input type="number" name="points" min={1} max={50} defaultValue={q.points} />
                </label>
                <button type="submit" name="decision" value="approved">
                  Aprobar
                </button>
                <button type="submit" name="decision" value="rejected">
                  Rechazar
                </button>
              </form>
            </article>
          ))}
        </>
      )}
      {role !== "organizer" && proposed.length > 0 && (
        <p>
          {proposed.length} pregunta(s) esperando aprobación de quien organiza.
        </p>
      )}

      <h2>Proponer una pregunta</h2>
      <p>
        Lo que sea: “¿cuántos bailes de salsa choke en este partido?”, “¿llora
        el comentarista si gana Colombia?”…
      </p>
      <form action={proposeAction}>
        <input type="hidden" name="groupId" value={group.id} />
        <label>
          Pregunta
          <input name="question" required minLength={5} maxLength={200} />
        </label>
        <label>
          Tipo de respuesta
          <select name="answerType">
            <option value="number">Número</option>
            <option value="boolean">Sí / No</option>
            <option value="choice">Opciones</option>
          </select>
        </label>
        <label>
          Opciones (una por línea, solo para tipo “Opciones”)
          <textarea name="options" rows={3} />
        </label>
        <label>
          Partido (opcional — la pregunta cierra cuando arranque)
          <select name="matchId" defaultValue="">
            <option value="">Sin partido — fijar cierre manual</option>
            {upcoming.map((m) => (
              <option key={m.id} value={m.id}>
                {m.homeTeam ?? "?"} vs {m.awayTeam ?? "?"} (
                {m.kickoffUtc.toLocaleDateString("es-CO", { timeZone: "America/Bogota" })})
              </option>
            ))}
          </select>
        </label>
        <label>
          Cierre manual (si no elegiste partido)
          <input type="datetime-local" name="lockAt" />
        </label>
        <label>
          Puntos sugeridos
          <input type="number" name="points" min={1} max={50} defaultValue={3} />
        </label>
        <button type="submit">Proponer</button>
      </form>
    </main>
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
      <input type="number" name="value" required defaultValue={current ?? ""} />
    );
  }
  if (answerType === "boolean") {
    return (
      <>
        <label>
          <input type="radio" name="value" value="si" required defaultChecked={current === "si"} />
          Sí
        </label>
        <label>
          <input type="radio" name="value" value="no" defaultChecked={current === "no"} />
          No
        </label>
      </>
    );
  }
  return (
    <select name="value" required defaultValue={current ?? ""}>
      <option value="" disabled>
        Elige…
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
    return <input type="number" name="correctValue" required />;
  }
  if (answerType === "boolean") {
    return (
      <select name="correctValue" required>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    );
  }
  return (
    <select name="correctValue" required>
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
  if (answers.length === 0) return <p>Nadie respondió.</p>;
  return (
    <ul>
      {answers.map((a) => (
        <li key={a.userId}>
          {a.displayName ?? "(sin nombre)"}: {a.value}
        </li>
      ))}
    </ul>
  );
}
