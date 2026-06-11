import Image from "next/image";
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
              Entre al parche y arme sus pronósticos.
            </p>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
