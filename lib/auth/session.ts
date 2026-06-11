import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "polla_session";

// comma-separated emails granted app admin (set via Fly secrets)
function isConfiguredAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function ensureAdminFlag<T extends { id: string; email: string; isAdmin: boolean }>(
  user: T,
): T {
  if (!user.isAdmin && isConfiguredAdmin(user.email)) {
    getDb().update(users).set({ isAdmin: true }).where(eq(users.id, user.id)).run();
    return { ...user, isAdmin: true };
  }
  return user;
}

export async function createSessionForEmail(email: string) {
  const db = getDb();
  const now = new Date();

  let user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    user = db
      .insert(users)
      .values({ id: randomUUID(), email, createdAt: now })
      .returning()
      .get();
  }

  const token = randomBytes(32).toString("hex");
  db.insert(sessions)
    .values({
      id: token,
      userId: user.id,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return ensureAdminFlag(user);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const row = db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .get();
  if (!row) return null;
  if (row.session.expiresAt < new Date()) {
    db.delete(sessions).where(eq(sessions.id, token)).run();
    return null;
  }
  // existing sessions pick up ADMIN_EMAILS grants without re-login
  return ensureAdminFlag(row.user);
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().delete(sessions).where(eq(sessions.id, token)).run();
    cookieStore.delete(SESSION_COOKIE);
  }
}
