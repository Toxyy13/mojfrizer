import { describe, expect, it } from "vitest";
import { safeNextPath } from "../landing";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/s/kod-olgice")).toBe("/s/kod-olgice");
    expect(safeNextPath("/admin?date=2026-10-20")).toBe("/admin?date=2026-10-20");
  });

  it("refuses anything that a browser could read as another site", () => {
    for (const value of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "https://evil.com", "evil.com", "", null, undefined]) {
      expect(safeNextPath(value)).toBeNull();
    }
  });
});
