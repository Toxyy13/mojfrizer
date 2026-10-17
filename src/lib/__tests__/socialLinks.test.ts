import { describe, expect, it } from "vitest";
import { normalizeSocial, safeSocialUrl } from "../socialLinks";

describe("normalizeSocial", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeSocial("instagram", "  ")).toBe("");
  });
  it("turns handles into canonical links", () => {
    expect(normalizeSocial("instagram", "@kod.olgice")).toBe("https://www.instagram.com/kod.olgice");
    expect(normalizeSocial("tiktok", "kodolgice")).toBe("https://www.tiktok.com/@kodolgice");
    expect(normalizeSocial("facebook", "KodOlgice")).toBe("https://www.facebook.com/KodOlgice");
  });
  it("accepts links on the network's own domain", () => {
    expect(normalizeSocial("instagram", "https://instagram.com/kod.olgice/?hl=sr")).toBe("https://www.instagram.com/kod.olgice");
    expect(normalizeSocial("tiktok", "www.tiktok.com/@kodolgice")).toBe("https://www.tiktok.com/@kodolgice");
  });
  it("rejects other domains, dangerous schemes and junk", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "https://evil.com/kod", "https://instagram.com.evil.com/x", "http://user:pw@instagram.com/x", "a b", "https://instagram.com/", "@"]) {
      expect(normalizeSocial("instagram", bad)).toBeNull();
    }
    expect(normalizeSocial("facebook", "https://instagram.com/x")).toBeNull();
  });
});

describe("safeSocialUrl", () => {
  it("drops anything that is not a valid link for the network", () => {
    expect(safeSocialUrl("instagram", "javascript:alert(1)")).toBeNull();
    expect(safeSocialUrl("instagram", null)).toBeNull();
    expect(safeSocialUrl("instagram", "https://www.instagram.com/x")).toBe("https://www.instagram.com/x");
  });
});
