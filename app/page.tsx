import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Plus, LogOut, Crown } from "lucide-react";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserGroups } from "@/lib/groups";
import { Header } from "@/app/components/shell";
import { logout } from "./login/actions";
import { setDisplayName } from "./actions";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="pc-hero-shell">
        <div className="pc-tricolor-rule" />
        <div className="pc-hero-shell__center">
          <div className="pc-hero-head">
            <Image src="/emblem.svg" alt="Pollera Colorá" width={76} height={76} />
            <div>
              <h1 style={{ margin: 0 }}>
                La pollera
                <br />
                está servida
              </h1>
              <p style={{ color: "var(--ink-soft)", margin: "8px 0 0" }}>
                La polla del Mundial 2026 para el parche. Pronósticos,
                preguntas del parche y la tabla para pelear.
              </p>
            </div>
          </div>
          <Link href="/login" className="pc-btn pc-btn--primary pc-btn--block pc-btn--lg">
            Entrar con su correo
          </Link>
          <p className="pc-hint" style={{ textAlign: "center", margin: 0 }}>
            Sin contraseñas. No se mueve plata por la app.
          </p>
        </div>
      </main>
    );
  }

  if (!user.displayName) {
    return (
      <main className="pc-hero-shell">
        <div className="pc-tricolor-rule" />
        <div className="pc-hero-shell__center">
          <div className="pc-hero-head">
            <Image src="/emblem.svg" alt="" width={56} height={56} />
            <h1 style={{ margin: 0 }}>¡Quiubo!</h1>
            <p style={{ color: "var(--ink-soft)", margin: 0 }}>
              ¿Cómo le decimos en las pollas?
            </p>
          </div>
          <form action={setDisplayName} className="pc-card pc-card--pad-lg pc-flow">
            <div className="pc-field">
              <label className="pc-label" htmlFor="displayName">
                Tu nombre
              </label>
              <input
                id="displayName"
                className="pc-input"
                name="displayName"
                placeholder="Como le dicen en el parche"
                required
                minLength={2}
                maxLength={40}
                autoFocus
              />
            </div>
            <button type="submit" className="pc-btn pc-btn--primary pc-btn--block">
              Listo
            </button>
          </form>
        </div>
      </main>
    );
  }

  const memberships = getUserGroups(getDb(), user.id);

  return (
    <>
      <Header>
        <form action={logout}>
          <button type="submit" className="pc-iconbtn" aria-label="Salir" title="Salir">
            <LogOut size={20} aria-hidden />
          </button>
        </form>
      </Header>
      <main className="page pc-flow">
        <div>
          <span className="eyebrow">Hola, {user.displayName}</span>
          <h1 style={{ margin: "2px 0 0" }}>Sus pollas</h1>
        </div>

        {memberships.length === 0 ? (
          <div className="pc-card pc-empty">
            <span className="pc-empty__art">⚽</span>
            <span className="pc-empty__title">Todavía no está en ninguna</span>
            <p className="pc-empty__body">
              Arme su propia polla o pídale el enlace a quien organiza la del
              parche.
            </p>
          </div>
        ) : (
          <div className="pc-flow" style={{ gap: "var(--gap-card)" }}>
            {memberships.map(({ group, role }) => (
              <Link key={group.id} href={`/g/${group.id}`} className="pc-card pc-quicklink">
                <span className="pc-quicklink__icon">
                  {role === "organizer" ? <Crown size={22} aria-hidden /> : <span aria-hidden>⚽</span>}
                </span>
                <span className="pc-quicklink__text">
                  <span className="pc-quicklink__label">{group.name}</span>
                  <span className="pc-quicklink__sub">
                    {role === "organizer" ? "Usted organiza esta polla" : "Es del parche"}
                  </span>
                </span>
                <ChevronRight size={20} className="pc-quicklink__chev" aria-hidden />
              </Link>
            ))}
          </div>
        )}

        <Link href="/g/new" className="pc-btn pc-btn--sticker pc-btn--block">
          <Plus size={18} aria-hidden /> Crear una polla
        </Link>
      </main>
    </>
  );
}
