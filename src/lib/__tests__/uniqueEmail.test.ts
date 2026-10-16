import { afterAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
const { systemDb } = await import("../db");

const run = Math.random().toString(36).slice(2, 8);
const email = `unique_${run}@test.rs`;

afterAll(async () => {
  await systemDb.user.deleteMany({ where: { id: `uq_${run}` } });
});

describe("one account per email", () => {
  it("refuses a second account whose email differs only in capitals", async () => {
    await systemDb.user.create({ data: { id: `uq_${run}`, email, name: "A", role: "CLIENT" } });
    await expect(systemDb.user.create({ data: { email: email.toUpperCase(), name: "B", role: "CLIENT" } })).rejects.toMatchObject({ code: "P2002" });
  });
});
