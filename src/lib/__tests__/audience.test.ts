import { describe, expect, it } from "vitest";
import { audienceWords, parseAudiences } from "../audience";

describe("audience", () => {
  it("keeps known values in a fixed order and drops the rest", () => {
    expect(parseAudiences(["KIDS", "x", "MEN", "KIDS"])).toEqual(["MEN", "KIDS"]);
    expect(parseAudiences([])).toEqual([]);
  });

  it("gives search words that survive the diacritics-free search", () => {
    expect(audienceWords(["WOMEN", "KIDS"])).toBe("Ženski Dečiji");
  });
});
