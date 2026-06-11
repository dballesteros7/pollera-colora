import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next && next.startsWith("/") ? next : "/");

  return (
    <main>
      <h1>Pollera Colora</h1>
      <p>Entra con tu correo — sin contraseñas.</p>
      <LoginForm next={next} />
    </main>
  );
}
