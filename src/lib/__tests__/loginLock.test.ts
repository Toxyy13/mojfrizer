// The login form's answers around the lock: a warning from the 3rd wrong password, a lock time at the 5th,
// and a refusal (even for the right password) while locked.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7", "user-agent": "Mozilla/5.0 test" }),
  cookies: async () => ({ set: () => undefined, delete: () => undefined, get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const { systemDb } = await import("../db");
const { hashPassword } = await import("../auth");
const { login } = await import("../../app/prijava/actions");

const run = Math.random().toString(36).slice(2, 8);
const email = `lock_${run}@test.rs`;

const attempt = (password: string) => {
  const form = new FormData();
  form.set("login", email);
  form.set("password", password);
  return login({ error: null }, form);
};

beforeAll(async () => {
  await systemDb.user.create({ data: { id: `lock_${run}`, email, name: "T", role: "CLIENT", passwordHash: await hashPassword("tacna-lozinka-1") } });
});

afterAll(async () => {
  await systemDb.rateLimit.deleteMany({ where: { key: { contains: email } } });
  await systemDb.rateLimit.deleteMany({ where: { key: "login:ip:203.0.113.7" } });
  await systemDb.rateLimit.deleteMany({ where: { key: "login:ipfail:203.0.113.7" } });
  await systemDb.user.deleteMany({ where: { id: `lock_${run}` } });
});

describe("login lock", () => {
  it("is silent for 2 wrong passwords, warns from the 3rd, locks at the 5th and refuses the right password", async () => {
    for (const n of [1, 2]) {
      const state = await attempt("pogresna");
      expect(state.error).toBe("Pogrešna email adresa ili lozinka.");
      expect(state.lockedUntil, `attempt ${n}`).toBeUndefined();
    }
    expect((await attempt("pogresna")).error).toContain("Još 2 pokušaja");
    expect((await attempt("pogresna")).error).toContain("Još 1 pokušaj:");
    const fifth = await attempt("pogresna");
    expect(fifth.lockedUntil).toBeGreaterThan(Date.now());
    const refused = await attempt("tacna-lozinka-1");
    expect(refused.lockedUntil).toBeGreaterThan(Date.now());
    expect(refused.error).toContain("previše puta");
  });
});
