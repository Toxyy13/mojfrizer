import { beforeEach, describe, expect, it, vi } from "vitest";

const salonFindFirst = vi.fn();
const getSessionUser = vi.fn();
const connect = vi.fn();

vi.mock("@/lib/db", () => ({ db: { salon: { findFirst: salonFindFirst } }, systemDb: { salon: { findFirst: salonFindFirst } } }));
vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/salonVisibility", () => ({ connectCustomerToSalon: connect }));

const TOKEN = "a".repeat(64);
const call = async (token: string) => {
  const { GET } = await import("@/app/q/[token]/route");
  const request = { nextUrl: { origin: "https://mojfrizer.test" } } as never;
  return GET(request, { params: Promise.resolve({ token }) });
};

beforeEach(() => {
  vi.clearAllMocks();
  salonFindFirst.mockResolvedValue({ id: "s1", slug: "kod-olgice" });
});

describe("QR link", () => {
  it("sends a visitor without an account to registration and back", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await call(TOKEN);
    expect(res.headers.get("location")).toBe(`https://mojfrizer.test/registracija?next=${encodeURIComponent(`/q/${TOKEN}`)}`);
    expect(connect).not.toHaveBeenCalled();
  });

  it("connects a logged-in customer and opens the salon", async () => {
    getSessionUser.mockResolvedValue({ id: "c1", role: "CLIENT" });
    const res = await call(TOKEN);
    expect(connect).toHaveBeenCalledWith("c1", "s1");
    expect(res.headers.get("location")).toBe("https://mojfrizer.test/s/kod-olgice");
  });

  it("does not turn staff into members", async () => {
    getSessionUser.mockResolvedValue({ id: "o1", role: "ADMIN" });
    const res = await call(TOKEN);
    expect(connect).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://mojfrizer.test/s/kod-olgice");
  });

  it("answers 404 for an unknown or short token", async () => {
    salonFindFirst.mockResolvedValue(null);
    getSessionUser.mockResolvedValue({ id: "c1", role: "CLIENT" });
    expect((await call(TOKEN)).status).toBe(404);
    expect((await call("short")).status).toBe(404);
    expect(connect).not.toHaveBeenCalled();
  });
});
