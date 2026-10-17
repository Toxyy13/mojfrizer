import { describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }));

const { assessLogin } = await import("../loginRisk");

const calm = { userAgent: "Mozilla/5.0", knownDevice: true, accountFailures: 0, ipFailures: 0, developer: false };

describe("assessLogin", () => {
  it("lets an ordinary login through, even from a new device", () => {
    expect(assessLogin(calm).risk).toBe("no_risk");
    expect(assessLogin({ ...calm, knownDevice: false }).risk).toBe("no_risk");
  });
  it("sends repeated failures from a new device to captcha", () => {
    expect(assessLogin({ ...calm, knownDevice: false, accountFailures: 2 }).risk).toBe("risky");
  });
  it("refuses scripts that keep failing", () => {
    expect(assessLogin({ ...calm, userAgent: "python-requests/2.31", ipFailures: 5 }).risk).toBe("dangerous");
    expect(assessLogin({ ...calm, userAgent: "" }).risk).toBe("risky");
  });
  it("is stricter for developer accounts", () => {
    expect(assessLogin({ ...calm, knownDevice: false, developer: true }).risk).toBe("risky");
    expect(assessLogin({ ...calm, developer: true }).risk).toBe("no_risk");
  });
});
