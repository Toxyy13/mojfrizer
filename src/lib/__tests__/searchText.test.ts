import { describe, expect, it } from "vitest";
import { fold, matchesQuery } from "../searchText";

describe("search text", () => {
  it("finds Niš however it is typed", () => {
    for (const q of ["Niš", "Nis", "nis", "NIŠ", "Ниш", "ниш"]) expect(matchesQuery(q, "Kod Olgice", "Niš")).toBe(true);
  });
  it("handles đ, dj, č, ć, ž and the Cyrillic forms", () => {
    expect(matchesQuery("Djordje", "Salon Đorđe")).toBe(true);
    expect(matchesQuery("dorde", "Salon Đorđe")).toBe(true);
    expect(matchesQuery("cacak", "Čačak")).toBe(true);
    expect(matchesQuery("Ćuprija", "Cuprija")).toBe(true);
    expect(matchesQuery("zeleznik", "Železnik")).toBe(true);
    expect(matchesQuery("Чачак", "Čačak")).toBe(true);
  });
  it("matches name and address words together and rejects others", () => {
    expect(matchesQuery("olgice nikole", "Kod Olgice", "Nikole Pašića 27")).toBe(true);
    expect(matchesQuery("pasica", "Kod Olgice", "Nikole Pašića 27")).toBe(true);
    expect(matchesQuery("beograd", "Kod Olgice", "Niš")).toBe(false);
  });
  it("folds consistently", () => {
    expect(fold("Đorđe")).toBe(fold("Djordje"));
  });
});
