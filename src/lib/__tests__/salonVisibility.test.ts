import { beforeEach, describe, expect, it, vi } from "vitest";

const salonFindUnique = vi.fn();
const getSessionUser = vi.fn();

vi.mock("@/lib/db", () => ({ db: { salon: { findUnique: salonFindUnique, findFirst: vi.fn() } } }));
vi.mock("../db", () => ({ db: { salon: { findUnique: salonFindUnique, findFirst: vi.fn() } } }));
vi.mock("../auth", () => ({ getSessionUser }));

const user = (id: string, role: "CLIENT" | "ADMIN" | "WORKER" | "DEVELOPER" = "CLIENT") => ({ id, email: null, name: "X", role });

// What the database returns for the salon, given who is asking.
const salonRow = (over: { visibility?: "PUBLIC" | "PRIVATE"; ownerId?: string; workers?: unknown[]; members?: unknown[] } = {}) => ({
  visibility: "PRIVATE",
  ownerId: "owner",
  workers: [],
  members: [],
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("canViewSalon", () => {
  it("lets everyone, including anonymous visitors, open a public salon", async () => {
    salonFindUnique.mockResolvedValue(salonRow({ visibility: "PUBLIC" }));
    const { canViewSalon } = await import("../salonVisibility");
    expect(await canViewSalon("s1", null)).toBe(true);
    expect(await canViewSalon("s1", user("c1"))).toBe(true);
  });

  it("hides a private salon from anonymous visitors", async () => {
    salonFindUnique.mockResolvedValue(salonRow());
    const { canViewSalon } = await import("../salonVisibility");
    expect(await canViewSalon("s1", null)).toBe(false);
  });

  it("hides a private salon from a customer who never scanned its QR", async () => {
    salonFindUnique.mockResolvedValue(salonRow());
    const { canViewSalon } = await import("../salonVisibility");
    expect(await canViewSalon("s1", user("other"))).toBe(false);
  });

  it("opens a private salon for a customer who scanned its QR", async () => {
    salonFindUnique.mockResolvedValue(salonRow({ members: [{ userId: "c1" }] }));
    const { canViewSalon } = await import("../salonVisibility");
    expect(await canViewSalon("s1", user("c1"))).toBe(true);
  });

  it("opens a private salon for its owner and for staff of that salon", async () => {
    const { canViewSalon } = await import("../salonVisibility");
    salonFindUnique.mockResolvedValue(salonRow({ ownerId: "o1" }));
    expect(await canViewSalon("s1", user("o1", "ADMIN"))).toBe(true);
    salonFindUnique.mockResolvedValue(salonRow({ workers: [{ id: "w1" }] }));
    expect(await canViewSalon("s1", user("w", "WORKER"))).toBe(true);
  });

  it("opens a private salon for the developer, but not for staff of another salon", async () => {
    salonFindUnique.mockResolvedValue(salonRow());
    const { canViewSalon } = await import("../salonVisibility");
    expect(await canViewSalon("s1", user("dev", "DEVELOPER"))).toBe(true);
    expect(await canViewSalon("s1", user("elsewhere", "ADMIN"))).toBe(false);
  });

  it("denies when the salon does not exist", async () => {
    salonFindUnique.mockResolvedValue(null);
    const { canViewSalon } = await import("../salonVisibility");
    expect(await canViewSalon("missing", user("c1"))).toBe(false);
  });
});

describe("decideViewAccess", () => {
  it("only asks for membership and staff facts of the viewer", async () => {
    const { decideViewAccess } = await import("../salonVisibility");
    expect(decideViewAccess({ visibility: "PRIVATE", isStaff: false, isMember: false }, { role: "CLIENT" })).toBe(false);
    expect(decideViewAccess({ visibility: "PRIVATE", isStaff: false, isMember: true }, { role: "CLIENT" })).toBe(true);
  });
});

describe("QR token", () => {
  it("is long and different every time", async () => {
    const { newQrToken } = await import("../salonVisibility");
    const a = newQrToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(newQrToken()).not.toBe(a);
  });
});
