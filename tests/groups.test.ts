import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createDb, type Db } from "../lib/db";
import { users } from "../lib/db/schema";
import {
  createGroup,
  joinGroup,
  getGroupByInviteCode,
  getUserGroups,
  getGroupForMember,
  getGroupMembers,
  regenerateInviteCode,
  generateInviteCode,
} from "../lib/groups";

const NOW = new Date("2026-06-11T20:00:00Z");

function makeUser(db: Db, email: string) {
  return db
    .insert(users)
    .values({ id: randomUUID(), email, createdAt: NOW })
    .returning()
    .get();
}

describe("groups", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("creator becomes organizer member", () => {
    const u = makeUser(db, "a@b.co");
    const g = createGroup(db, u.id, {
      name: "La polla de la oficina",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    const access = getGroupForMember(db, u.id, g.id);
    expect(access?.role).toBe("organizer");
    expect(getUserGroups(db, u.id)).toHaveLength(1);
  });

  it("join via invite code is idempotent", () => {
    const organizer = makeUser(db, "a@b.co");
    const friend = makeUser(db, "c@d.co");
    const g = createGroup(db, organizer.id, {
      name: "Parche",
      scoringRules: { preset: "escalonada", unicoAcertado: true },
    });
    const found = getGroupByInviteCode(db, g.inviteCode.toLowerCase());
    expect(found?.id).toBe(g.id);

    joinGroup(db, friend.id, g.id, NOW);
    joinGroup(db, friend.id, g.id, NOW);
    expect(getGroupMembers(db, g.id)).toHaveLength(2);
    expect(getGroupForMember(db, friend.id, g.id)?.role).toBe("member");
  });

  it("non-members have no access", () => {
    const organizer = makeUser(db, "a@b.co");
    const stranger = makeUser(db, "x@y.co");
    const g = createGroup(db, organizer.id, {
      name: "Privada",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    expect(getGroupForMember(db, stranger.id, g.id)).toBeNull();
  });

  it("regenerating the code invalidates the old one", () => {
    const u = makeUser(db, "a@b.co");
    const g = createGroup(db, u.id, {
      name: "Polla",
      scoringRules: { preset: "clasica", unicoAcertado: false },
    });
    const oldCode = g.inviteCode;
    const { inviteCode: newCode } = regenerateInviteCode(db, g.id)!;
    expect(newCode).not.toBe(oldCode);
    expect(getGroupByInviteCode(db, oldCode)).toBeNull();
    expect(getGroupByInviteCode(db, newCode)?.id).toBe(g.id);
  });

  it("invite codes use the unambiguous alphabet", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateInviteCode()).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    }
  });
});
