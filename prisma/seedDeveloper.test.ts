import { compare } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { ensureDeveloper } from "./seedDeveloper";

function fakeDb(existing: { id: string; role: string } | null, others: unknown[] = []) {
  return {
    user: {
      findUnique: vi.fn(async () => existing),
      findMany: vi.fn(async () => others),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
  };
}
const env = { SEED_DEVELOPER_EMAIL: "Dev@Example.com", SEED_DEVELOPER_PASSWORD: "correct-horse-battery" };

describe("ensureDeveloper", () => {
  it("is skipped without email and password (e.g. before they are set on the host)", async () => {
    const db = fakeDb(null);
    expect(await ensureDeveloper(db as never, {})).toBe("skipped");
    expect(await ensureDeveloper(db as never, { SEED_DEVELOPER_EMAIL: "a@b.rs" })).toBe("skipped");
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("creates the account with a hashed password and the DEVELOPER role", async () => {
    const db = fakeDb(null);
    expect(await ensureDeveloper(db as never, env)).toBe("created");
    const data = (db.user.create.mock.calls[0] as unknown as [{ data: { email: string; role: string; passwordHash: string } }])[0].data;
    expect(data.email).toBe("dev@example.com");
    expect(data.role).toBe("DEVELOPER");
    expect(data.passwordHash).not.toContain("correct-horse");
    expect(await compare("correct-horse-battery", data.passwordHash)).toBe(true);
  });

  it("promotes an existing account", async () => {
    const db = fakeDb({ id: "u1", role: "CLIENT" });
    expect(await ensureDeveloper(db as never, env)).toBe("promoted");
    expect(db.user.update).toHaveBeenCalledOnce();
  });

  it("changes nothing on a second run", async () => {
    const db = fakeDb({ id: "u1", role: "DEVELOPER" });
    expect(await ensureDeveloper(db as never, env)).toBe("unchanged");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("moves the role when the developer email changes: the old account is demoted", async () => {
    const db = fakeDb(null, [{ id: "old", ownedSalons: [], workerProfiles: [] }, { id: "old2", ownedSalons: [{ id: "s" }], workerProfiles: [] }]);
    expect(await ensureDeveloper(db as never, env)).toBe("created");
    const roles = (db.user.update.mock.calls as unknown as Array<[{ data: { role: string } }]>).map((c) => c[0].data.role);
    expect(roles).toEqual(["CLIENT", "ADMIN"]);
  });

  it("rejects a short password", async () => {
    await expect(ensureDeveloper(fakeDb(null) as never, { ...env, SEED_DEVELOPER_PASSWORD: "short" })).rejects.toThrow();
  });
});
