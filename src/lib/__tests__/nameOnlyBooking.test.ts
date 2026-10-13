// The owner or staff can book a customer by name alone (no phone). Runs against real PostgreSQL.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
vi.mock("../mail", () => ({ sendMail: vi.fn(async () => true) }));
vi.mock("@/lib/auth", () => ({ getSessionUser: vi.fn(async () => null) }));

const { ownerDb } = await import("../db");
const { bookingInputSchema, salonBookingInputSchema, createAppointment } = await import("../booking");
const { clientKeyOf, listSalonClients } = await import("../clients");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `nob_${run}_${name}`;
const ids = { owner: id("owner"), salon: id("salon"), w: id("w"), s: id("s") };
const DAY = "2031-05-05"; // a Monday, far in the future

beforeAll(async () => {
  await ownerDb.user.create({ data: { id: ids.owner, email: `${ids.owner}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: "x" } });
  await ownerDb.salon.create({
    data: { id: ids.salon, name: "Test", slug: ids.salon, city: "Niš", address: "Ulica 1", ownerId: ids.owner },
  });
  await ownerDb.workingHours.create({ data: { salonId: ids.salon, dayOfWeek: 1, opensAt: 9 * 60, closesAt: 21 * 60 } });
  await ownerDb.workerProfile.create({ data: { id: ids.w, salonId: ids.salon, displayName: "Frizer" } });
  await ownerDb.service.create({ data: { id: ids.s, salonId: ids.salon, name: "Šišanje", price: 60000, durationMinutes: 30 } });
});

afterAll(async () => {
  await ownerDb.appointment.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.salon.deleteMany({ where: { id: ids.salon } });
  await ownerDb.user.deleteMany({ where: { id: ids.owner } });
  await ownerDb.$disconnect();
});

const base = { serviceIds: ["x"], dateIso: DAY, minute: 600, clientName: "Marko", note: null };

describe("booking input", () => {
  it("salon form needs only a name; phone may be missing or empty", () => {
    expect(salonBookingInputSchema.safeParse(base).success).toBe(true);
    expect(salonBookingInputSchema.safeParse({ ...base, clientPhone: "" }).success).toBe(true);
    expect(salonBookingInputSchema.safeParse({ ...base, clientPhone: "   " }).success).toBe(true);
    expect(salonBookingInputSchema.safeParse({ ...base, clientName: "" }).success).toBe(false);
  });
  it("a phone that is given is still validated", () => {
    expect(salonBookingInputSchema.safeParse({ ...base, clientPhone: "abc" }).success).toBe(false);
    expect(salonBookingInputSchema.safeParse({ ...base, clientPhone: "064 111 2233" }).success).toBe(true);
  });
  it("public online booking still requires a phone", () => {
    expect(bookingInputSchema.safeParse(base).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...base, clientPhone: "" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...base, clientPhone: "064 111 2233" }).success).toBe(true);
  });
});

describe("name-only appointment", () => {
  it("is stored, listed as its own customer and never merged with another by name", async () => {
    const actor = { source: "SALON" as const, createdById: ids.owner, clientId: null };
    const input = { serviceIds: [ids.s], workerId: ids.w, dateIso: DAY, minute: 600, clientName: "Marko", clientPhone: null, note: null };
    const a = await createAppointment(ids.salon, input, actor);
    const b = await createAppointment(ids.salon, { ...input, minute: 660 }, actor);
    expect(a.ok && b.ok).toBe(true);

    const rows = await ownerDb.appointment.findMany({ where: { salonId: ids.salon } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.guestPhone === null && r.guestName === "Marko")).toBe(true);
    expect(rows.every((r) => r.price === 60000)).toBe(true);
    expect(new Set(rows.map((r) => clientKeyOf(r))).size).toBe(2);

    const clients = await listSalonClients(ids.salon);
    expect(clients).toHaveLength(2);
    expect(clients.every((c) => c.name === "Marko" && c.phone === null)).toBe(true);
  });
});
