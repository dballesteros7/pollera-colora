import { requireUser } from "@/lib/auth/require";
import { PRESETS } from "@/lib/scoring/presets";
import { getLocale, t } from "@/lib/i18n";
import { Header } from "@/app/components/shell";
import { createGroupAction } from "./actions";

export default async function NewGroupPage() {
  await requireUser("/g/new");
  const lo = await getLocale();

  return (
    <>
      <Header />
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">{t(lo, "new.eyebrow")}</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{t(lo, "new.title")}</h1>
        </div>

        <form action={createGroupAction} className="pc-card pc-card--pad-lg pc-flow">
          <div className="pc-field">
            <label className="pc-label" htmlFor="group-name">{t(lo, "new.name")}</label>
            <input
              id="group-name"
              className="pc-input"
              name="name"
              placeholder={t(lo, "new.namePh")}
              required
              minLength={2}
              maxLength={60}
              autoFocus
            />
          </div>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }} className="pc-flow">
            <legend className="pc-label" style={{ marginBottom: "var(--space-2)" }}>
              {t(lo, "new.scoring")}
            </legend>
            {Object.values(PRESETS).map((p, i) => (
              <label key={p.id} className="pc-option">
                <input type="radio" name="preset" value={p.id} defaultChecked={i === 0} />
                <span>
                  <span className="pc-option__title">{t(lo, `preset.${p.id}`)}</span>
                  <span className="pc-option__desc">{t(lo, `preset.${p.id}.d`)}</span>
                </span>
              </label>
            ))}
            <label className="pc-option">
              <input type="checkbox" name="unicoAcertado" />
              <span>
                <span className="pc-option__title">{t(lo, "new.unico")}</span>
                <span className="pc-option__desc">
                  {t(lo, "new.unicoSub")}
                </span>
              </span>
            </label>
          </fieldset>

          <div className="pc-field">
            <label className="pc-label" htmlFor="pot-note">
              {t(lo, "new.vacaLabel")} <span className="pc-hint">{t(lo, "new.vacaHint")}</span>
            </label>
            <input
              id="pot-note"
              className="pc-input"
              name="potNote"
              placeholder={t(lo, "set.vacaPh")}
              maxLength={200}
            />
          </div>

          <button type="submit" className="pc-btn pc-btn--sticker pc-btn--block pc-btn--lg">
            {t(lo, "new.create")}
          </button>
        </form>
      </main>
    </>
  );
}
