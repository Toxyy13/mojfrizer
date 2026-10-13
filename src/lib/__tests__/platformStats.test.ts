import { describe, expect, it } from "vitest";
import { currentMonthIso, fillMonths, growthPercent, shiftMonthIso } from "../platformStats";

describe("growthPercent", () => {
  it("compares with the previous month", () => {
    expect(growthPercent(150, 100)).toBe(50);
    expect(growthPercent(50, 100)).toBe(-50);
  });
  it("has nothing to compare against when last month was empty", () => {
    expect(growthPercent(100, 0)).toBeNull();
  });
});

describe("months", () => {
  it("shifts across year ends", () => {
    expect(shiftMonthIso("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthIso("2026-11", 3)).toBe("2027-02");
  });
  it("uses the Belgrade calendar month", () => {
    expect(currentMonthIso(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10");
  });
  it("fills missing months with zeros, oldest first", () => {
    const filled = fillMonths([{ monthIso: "2026-10", bookings: 2, revenuePara: 100, bookedPara: 300 }], "2026-10", 3);
    expect(filled.map((p) => p.monthIso)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(filled[0].bookedPara).toBe(0);
    expect(filled[2].bookedPara).toBe(300);
  });
});
