import { createHash, randomInt } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { otpCodes } from "../db/schema";
import { sendOtpEmail } from "../email";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_ACTIVE_CODES = 3; // per email within the TTL window

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export class OtpRateLimitError extends Error {}

export async function requestOtp(
  db: Db,
  rawEmail: string,
  now = new Date(),
  locale: import("../i18n").Locale = "es",
) {
  const email = normalizeEmail(rawEmail);
  const active = db
    .select({ n: sql<number>`count(*)` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        eq(otpCodes.consumed, false),
        gt(otpCodes.expiresAt, now),
      ),
    )
    .get();
  if ((active?.n ?? 0) >= MAX_ACTIVE_CODES) {
    throw new OtpRateLimitError(
      "Too many codes requested — wait a few minutes and try again.",
    );
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  // send first — a failed delivery must not consume the rate limit
  await sendOtpEmail(email, code, locale);
  db.insert(otpCodes)
    .values({
      email,
      codeHash: hashCode(code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    })
    .run();
  return { email };
}

export type VerifyResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyOtp(
  db: Db,
  rawEmail: string,
  code: string,
  now = new Date(),
): VerifyResult {
  const email = normalizeEmail(rawEmail);
  const candidates = db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.consumed, false)))
    .all();

  const live = candidates.filter((c) => c.expiresAt > now);
  if (live.length === 0) {
    return { ok: false, reason: candidates.length ? "expired" : "invalid" };
  }

  const hash = hashCode(code.trim());
  const match = live.find(
    (c) => c.attempts < MAX_ATTEMPTS && c.codeHash === hash,
  );
  if (match) {
    db.update(otpCodes)
      .set({ consumed: true })
      .where(eq(otpCodes.id, match.id))
      .run();
    return { ok: true, email };
  }

  for (const c of live) {
    db.update(otpCodes)
      .set({ attempts: c.attempts + 1 })
      .where(eq(otpCodes.id, c.id))
      .run();
  }
  return { ok: false, reason: "invalid" };
}
