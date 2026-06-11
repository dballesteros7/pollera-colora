import { requireUser } from "@/lib/auth/require";
import { PRESETS } from "@/lib/scoring/presets";
import { createGroupAction } from "./actions";

export default async function NewGroupPage() {
  await requireUser("/g/new");

  return (
    <main>
      <h1>Crear una polla</h1>
      <form action={createGroupAction}>
        <label>
          Nombre de la polla
          <input name="name" required minLength={2} maxLength={60} autoFocus />
        </label>

        <fieldset>
          <legend>Sistema de puntos</legend>
          {Object.values(PRESETS).map((p, i) => (
            <label key={p.id}>
              <input
                type="radio"
                name="preset"
                value={p.id}
                defaultChecked={i === 0}
              />
              <strong>{p.name}</strong> — {p.description}
            </label>
          ))}
          <label>
            <input type="checkbox" name="unicoAcertado" />
            Único acertado: +5 si solo tú pegas el marcador exacto
          </label>
        </fieldset>

        <label>
          Nota del premio (opcional, p. ej. “$50.000 entrada, 70/20/10”)
          <input name="potNote" maxLength={200} />
        </label>

        <button type="submit">Crear</button>
      </form>
    </main>
  );
}
