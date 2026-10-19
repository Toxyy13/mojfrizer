// A new account can't log in before its email is confirmed; the right password then says so instead of logging in.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.8", "user-agent": "Mozilla/5.0 test" }),
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
const email = `verify_${run}@test.rs`;

const attempt = () => {
  const form = new FormData();
  form.set("login", email);
  form.set("password", "tacna-lozinka-1");
  return login({ error: null }, form);
};

beforeAll(async () => {
  await systemDb.user.create({ data: { id: `verify_${run}`, email, name: "T", role: "CLIENT", passwordHash: await hashPassword("tacna-lozinka-1") } });
});

afterAll(async () => {
  await systemDb.rateLimit.deleteMany({ where: { key: { in: ["login:ip:203.0.113.8", "login:ipfail:203.0.113.8"] } } });
  await systemDb.user.deleteMany({ where: { id: `verify_${run}` } });
});

describe("login before email confirmation", () => {
  it("refuses an unconfirmed email, then logs in once it is confirmed", async () => {
    const refused = await attempt();
    expect(refused.unverified).toBe(true);
    await systemDb.user.update({ where: { id: `verify_${run}` }, data: { emailVerifiedAt: new Date() } });
    await expect(attempt()).rejects.toThrow("redirect:");
  });
});
