import { requireUser } from "@/lib/auth/require";
import { PRESETS } from "@/lib/scoring/presets";
import { Header } from "@/app/components/shell";
import { createGroupAction } from "./actions";

export default async function NewGroupPage() {
  await requireUser("/g/new");

  return (
    <>
      <Header />
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">Nueva polla</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>Armá tu polla</h1>
        </div>

        <form action={createGroupAction} className="pc-card pc-card--pad-lg pc-flow">
          <div className="pc-field">
            <label className="pc-label" htmlFor="group-name">Nombre de la polla</label>
            <input
              id="group-name"
              className="pc-input"
              name="name"
              placeholder="Polla de la oficina"
              required
              minLength={2}
              maxLength={60}
              autoFocus
            />
          </div>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }} className="pc-flow">
            <legend className="pc-label" style={{ marginBottom: "var(--space-2)" }}>
              Sistema de puntos
            </legend>
            {Object.values(PRESETS).map((p, i) => (
              <label key={p.id} className="pc-option">
                <input type="radio" name="preset" value={p.id} defaultChecked={i === 0} />
                <span>
                  <span className="pc-option__title">{p.name}</span>
                  <span className="pc-option__desc">{p.description}</span>
                </span>
              </label>
            ))}
            <label className="pc-option">
              <input type="checkbox" name="unicoAcertado" />
              <span>
                <span className="pc-option__title">Único acertado</span>
                <span className="pc-option__desc">
                  +5 si solo vos pegás el marcador exacto
                </span>
              </span>
            </label>
          </fieldset>

          <div className="pc-field">
            <label className="pc-label" htmlFor="pot-note">
              Pozo <span className="pc-hint">(opcional — la plata va por fuera de la app)</span>
            </label>
            <input
              id="pot-note"
              className="pc-input"
              name="potNote"
              placeholder="$50.000 entrada · 70/20/10"
              maxLength={200}
            />
          </div>

          <button type="submit" className="pc-btn pc-btn--sticker pc-btn--block pc-btn--lg">
            ¡Crear la polla!
          </button>
        </form>
      </main>
    </>
  );
}
