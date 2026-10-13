import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const userFindUnique = vi.fn();
const userCreate = vi.fn();
const salonUpdate = vi.fn();
const salonFindUnique = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser, hashPassword: vi.fn(async () => "hash") }));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: userFindUnique, create: userCreate }, salon: { update: salonUpdate, findUnique: salonFindUnique } },
}));
vi.mock("@/lib/accountMail", () => ({ sendResetMail: vi.fn(), sendVerificationMail: vi.fn(async () => true) }));
vi.mock("@/lib/salonOnboarding", () => ({ createSalon: vi.fn(async () => "novi-salon") }));

const session = (role: string) => ({ id: "u1", email: "a@b.rs", name: "A", role });
const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireDeveloper", () => {
  it("denies visitors without a session", async () => {
    getSessionUser.mockResolvedValue(null);
    const { requireDeveloper } = await import("../developer");
    await expect(requireDeveloper()).rejects.toThrow("NOT_FOUND");
  });

  it.each(["ADMIN", "WORKER", "CLIENT"])("denies a %s", async (role) => {
    getSessionUser.mockResolvedValue(session(role));
    userFindUnique.mockResolvedValue({ id: "u1", email: "a@b.rs", name: "A", role });
    const { requireDeveloper } = await import("../developer");
    await expect(requireDeveloper()).rejects.toThrow("NOT_FOUND");
  });

  it("trusts the database, not the cookie: a cookie claiming DEVELOPER is denied", async () => {
    getSessionUser.mockResolvedValue(session("DEVELOPER"));
    userFindUnique.mockResolvedValue({ id: "u1", email: "a@b.rs", name: "A", role: "ADMIN" });
    const { requireDeveloper } = await import("../developer");
    await expect(requireDeveloper()).rejects.toThrow("NOT_FOUND");
  });

  it("denies a deleted account", async () => {
    getSessionUser.mockResolvedValue(session("DEVELOPER"));
    userFindUnique.mockResolvedValue(null);
    const { requireDeveloper } = await import("../developer");
    await expect(requireDeveloper()).rejects.toThrow("NOT_FOUND");
  });

  it("lets the developer in", async () => {
    getSessionUser.mockResolvedValue(session("DEVELOPER"));
    userFindUnique.mockResolvedValue({ id: "u1", email: "a@b.rs", name: "A", role: "DEVELOPER" });
    const { requireDeveloper } = await import("../developer");
    await expect(requireDeveloper()).resolves.toMatchObject({ role: "DEVELOPER" });
  });
});

describe("developer actions", () => {
  const salonForm = form({ salonName: "Novi", city: "Niš", address: "Ulica 1", ownerName: "Vlasnik", ownerEmail: "v@x.rs", password: "" });

  it.each(["ADMIN", "CLIENT"])("a %s cannot create a salon", async (role) => {
    getSessionUser.mockResolvedValue(session(role));
    userFindUnique.mockResolvedValue({ id: "u1", role });
    const { createSalonAccount } = await import("@/app/razvoj/actions");
    await expect(createSalonAccount({ error: null }, salonForm)).rejects.toThrow("NOT_FOUND");
    expect(userCreate).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "CLIENT"])("a %s cannot suspend a salon", async (role) => {
    getSessionUser.mockResolvedValue(session(role));
    userFindUnique.mockResolvedValue({ id: "u1", role });
    const { setSalonActive } = await import("@/app/razvoj/actions");
    await expect(setSalonActive(form({ salonId: "s1", active: "false" }))).rejects.toThrow("NOT_FOUND");
    expect(salonUpdate).not.toHaveBeenCalled();
  });

  it("the developer creates a salon with an owner account and a one-time password", async () => {
    getSessionUser.mockResolvedValue(session("DEVELOPER"));
    userFindUnique.mockResolvedValueOnce({ id: "u1", role: "DEVELOPER" }).mockResolvedValueOnce(null);
    userCreate.mockResolvedValue({ id: "o1", name: "Vlasnik" });
    const { createSalonAccount } = await import("@/app/razvoj/actions");
    const result = await createSalonAccount({ error: null }, salonForm);
    expect(result.created).toMatchObject({ slug: "novi-salon", ownerEmail: "v@x.rs" });
    expect(result.created?.tempPassword).toHaveLength(12);
    expect(userCreate.mock.calls[0][0].data.role).toBe("ADMIN");
  });
});
