import { describe, expect, it } from "vitest";
import { comboRulePrices } from "../comboRule";
import { readServiceForm } from "../salonSettings";
import { visitItemPrices } from "../visit";

const haircut = { price: 60000, comboPrice: null };
const beard = { price: 20000, comboPrice: 0 };
const wash = { price: 15000, comboPrice: 10000 };

describe("comboRulePrices", () => {
  it("charges the normal price for a single service", () => {
    expect(comboRulePrices([beard])).toEqual([20000]);
  });
  it("applies comboPrice (0 = gratis) next to a full-price service", () => {
    expect(comboRulePrices([haircut, beard])).toEqual([60000, 0]);
    expect(comboRulePrices([beard, haircut])).toEqual([0, 60000]);
  });
  it("lets a service without comboPrice pay in full", () => {
    expect(comboRulePrices([haircut, wash, beard])).toEqual([60000, 10000, 0]);
  });
  it("never makes a visit free when every service has a comboPrice", () => {
    expect(comboRulePrices([beard, wash])).toEqual([20000, 10000]);
    expect(visitItemPrices([wash, beard])).toEqual([10000, 20000]);
  });
  it("ignores a comboPrice above the normal price", () => {
    expect(comboRulePrices([haircut, { price: 10000, comboPrice: 50000 }])).toEqual([60000, 10000]);
  });
});

describe("service form", () => {
  const form = (combo: string) => {
    const f = new FormData();
    f.set("name", "Brijanje");
    f.set("priceRsd", "150");
    f.set("comboPriceRsd", combo);
    f.set("durationMinutes", "15");
    return readServiceForm(f);
  };
  it("accepts empty (no combo price), 0 (gratis) and a price", () => {
    expect(form("").data?.comboPriceRsd).toBe("");
    expect(form("0").data?.comboPriceRsd).toBe(0);
    expect(form("100").data?.comboPriceRsd).toBe(100);
  });
  it("rejects a negative combo price", () => {
    expect(form("-5").success).toBe(false);
  });
});
