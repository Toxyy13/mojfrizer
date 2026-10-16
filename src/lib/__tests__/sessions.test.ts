import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "mf_session" && cookieValue ? { value: cookieValue } : undefined) }),
  headers: async () => new Headers(),
}));

const { getSessionUser, revokeSessions } = await import("../auth");
const { userForProfile } = await import("../google");
const { ownerDb } = await import("../db");

const run = Math.random().toString(36).slice(2, 8);
const uid = `sess_${run}`;

async function cookieFor(id: string, role: string, issuedAt: number): Promise<string> {
  return new SignJWT({ email: null, name: "X", role }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt(issuedAt).setExpirationTime("1d").sign(secret);
}

beforeAll(async () => {
  await ownerDb.user.create({ data: { id: uid, email: `${uid}@test.rs`, name: "Sesija", role: "CLIENT", passwordHash: "x" } });
});
afterAll(async () => {
  await ownerDb.user.deleteMany({ where: { id: { startsWith: "sess_" + run } } });
});

describe("sessions", () => {
  it("reads the role from the database, not from the cookie", async () => {
    cookieValue = await cookieFor(uid, "DEVELOPER", Math.floor(Date.now() / 1000));
    expect((await getSessionUser())?.role).toBe("CLIENT");
  });

  it("refuses cookies issued before the sessions were revoked, and for deleted accounts", async () => {
    const old = Math.floor(Date.now() / 1000) - 120;
    cookieValue = await cookieFor(uid, "CLIENT", old);
    expect(await getSessionUser()).not.toBeNull();
    await revokeSessions(uid);
    expect(await getSessionUser()).toBeNull();
    cookieValue = await cookieFor(`${uid}_gone`, "CLIENT", Math.floor(Date.now() / 1000));
    expect(await getSessionUser()).toBeNull();
  });
});

describe("Google sign-in linking", () => {
  it("drops the password of an account whose email was never confirmed", async () => {
    const id = `sess_${run}_pre`;
    await ownerDb.user.create({ data: { id, email: `${id}@test.rs`, name: "Napadač", role: "CLIENT", passwordHash: "attacker-hash" } });
    const user = await userForProfile({ sub: `g_${run}`, email: `${id}@test.rs`, name: "Vlasnik" });
    expect(user.id).toBe(id);
    const after = await ownerDb.user.findUniqueOrThrow({ where: { id } });
    expect(after.passwordHash).toBeNull();
    expect(after.googleId).toBe(`g_${run}`);
    expect(after.emailVerifiedAt).not.toBeNull();
  });

  it("keeps the password of an account whose email was confirmed", async () => {
    const id = `sess_${run}_ver`;
    await ownerDb.user.create({ data: { id, email: `${id}@test.rs`, name: "Prava", role: "CLIENT", passwordHash: "keep", emailVerifiedAt: new Date() } });
    await userForProfile({ sub: `g2_${run}`, email: `${id}@test.rs`, name: "Prava" });
    expect((await ownerDb.user.findUniqueOrThrow({ where: { id } })).passwordHash).toBe("keep");
  });
});
