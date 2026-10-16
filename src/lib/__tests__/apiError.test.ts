import { describe, expect, it } from "vitest";
import { apiError, readJson } from "../apiError";

describe("apiError", () => {
  it("uses one shape with a stable code", async () => {
    const response = apiError(404, "Salon nije pronađen.");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Salon nije pronađen.", code: "not_found" });
  });

  it("falls back to a generic text and passes headers through", async () => {
    const response = apiError(429, undefined, { "Retry-After": "60" });
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toMatchObject({ code: "rate_limited" });
  });

  it("readJson answers null for a broken body instead of throwing", async () => {
    expect(await readJson(new Request("http://x", { method: "POST", body: "{nope" }))).toBeNull();
    expect(await readJson(new Request("http://x", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
  });
});
