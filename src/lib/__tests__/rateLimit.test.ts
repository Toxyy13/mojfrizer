import { afterAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
const { consume, isBlocked, recordHit, clearLimit, ipFrom, keyPart } = await import("../rateLimit");
const { ownerDb } = await import("../db");

const run = Math.random().toString(36).slice(2, 8);
const key = (n: string): string => `test:${run}:${n}`;

afterAll(async () => {
  await ownerDb.rateLimit.deleteMany({ where: { key: { startsWith: `test:${run}:` } } });
});

describe("rate limiting", () => {
  it("allows up to the limit, then blocks with a wait time", async () => {
    const rule = { key: key("a"), limit: 3, windowSec: 60 };
    for (let i = 0; i < 3; i++) expect((await consume([rule])).ok).toBe(true);
    const blocked = await consume([rule]);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts failures separately and a success clears them", async () => {
    const rule = { key: key("b"), limit: 2, windowSec: 60 };
    expect((await isBlocked(rule)).ok).toBe(true);
    await recordHit(rule);
    await recordHit(rule);
    expect((await isBlocked(rule)).ok).toBe(false);
    await clearLimit(rule.key);
    expect((await isBlocked(rule)).ok).toBe(true);
  });

  it("starts a fresh window once the old one is over", async () => {
    const rule = { key: key("c"), limit: 1, windowSec: 60 };
    await consume([rule]);
    await consume([rule]);
    expect((await consume([rule])).ok).toBe(false);
    await ownerDb.rateLimit.update({ where: { key: rule.key }, data: { windowStart: new Date(Date.now() - 120_000) } });
    expect((await consume([rule])).ok).toBe(true);
  });

  it("takes the caller address from trusted headers and ignores junk", () => {
    expect(ipFrom((n) => (n === "x-vercel-forwarded-for" ? "1.2.3.4" : null))).toBe("1.2.3.4");
    expect(ipFrom((n) => (n === "x-forwarded-for" ? "5.6.7.8, 10.0.0.1" : null))).toBe("5.6.7.8");
    expect(ipFrom((n) => (n === "x-forwarded-for" ? "<script>" : null))).toBe("unknown");
    expect(keyPart(" Ana@Test.RS ")).toBe("ana@test.rs");
  });
});
