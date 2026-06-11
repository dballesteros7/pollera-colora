import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "./login/actions";
import { setDisplayName } from "./actions";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main>
        <h1>Pollera Colora</h1>
        <p>La polla del Mundial 2026 para tu combo.</p>
        <Link href="/login">Entrar</Link>
      </main>
    );
  }

  if (!user.displayName) {
    return (
      <main>
        <h1>¡Bienvenido!</h1>
        <p>¿Cómo te llamamos en las pollas?</p>
        <form action={setDisplayName}>
          <input
            name="displayName"
            required
            minLength={2}
            maxLength={40}
            autoFocus
          />
          <button type="submit">Listo</button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <h1>Hola, {user.displayName}</h1>
      {/* Phase 2: list of the user's pollas + create button goes here */}
      <p>Tus pollas aparecerán aquí.</p>
      <form action={logout}>
        <button type="submit">Salir</button>
      </form>
    </main>
  );
}
