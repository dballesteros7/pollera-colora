import { describe, it, expect, beforeEach, vi } from "vitest";
import { createDb, type Db } from "../lib/db";
import { requestOtp, verifyOtp, OtpRateLimitError } from "../lib/auth/otp";

vi.mock("../lib/email", () => ({
  sendOtpEmail: vi.fn(async (_email: string, code: string) => {
    sentCodes.push(code);
  }),
}));

const sentCodes: string[] = [];
const NOW = new Date("2026-06-11T20:00:00Z");

describe("otp", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
    sentCodes.length = 0;
  });

  it("round-trips a valid code", async () => {
    await requestOtp(db, "Diego@Example.com ", NOW);
    expect(sentCodes).toHaveLength(1);
    const result = verifyOtp(db, "diego@example.com", sentCodes[0], NOW);
    expect(result).toEqual({ ok: true, email: "diego@example.com" });
  });

  it("rejects a wrong code and counts attempts", async () => {
    await requestOtp(db, "a@b.co", NOW);
    for (let i = 0; i < 5; i++) {
      expect(verifyOtp(db, "a@b.co", "000000", NOW).ok).toBe(false);
    }
    // attempts exhausted: even the right code no longer works
    expect(verifyOtp(db, "a@b.co", sentCodes[0], NOW).ok).toBe(false);
  });

  it("codes are single-use", async () => {
    await requestOtp(db, "a@b.co", NOW);
    expect(verifyOtp(db, "a@b.co", sentCodes[0], NOW).ok).toBe(true);
    expect(verifyOtp(db, "a@b.co", sentCodes[0], NOW).ok).toBe(false);
  });

  it("codes expire", async () => {
    await requestOtp(db, "a@b.co", NOW);
    const later = new Date(NOW.getTime() + 11 * 60 * 1000);
    const result = verifyOtp(db, "a@b.co", sentCodes[0], later);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rate-limits active codes per email", async () => {
    await requestOtp(db, "a@b.co", NOW);
    await requestOtp(db, "a@b.co", NOW);
    await requestOtp(db, "a@b.co", NOW);
    await expect(requestOtp(db, "a@b.co", NOW)).rejects.toThrow(
      OtpRateLimitError,
    );
    // but another email is fine
    await expect(requestOtp(db, "c@d.co", NOW)).resolves.toBeTruthy();
  });
});
