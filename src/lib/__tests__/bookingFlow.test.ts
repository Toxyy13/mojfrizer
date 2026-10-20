// Main customer flow end to end on real PostgreSQL: book (combo price), sign in check, cancel with the link, cutoff.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
vi.mock("../mail", () => ({ sendMail: vi.fn(async () => true) }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() })) }));

const { ownerDb } = await import("../db");
const { createAppointment, getAvailableSlots } = await import("../booking");
const { cancelByCustomer } = await import("../manageBooking");
const { verifyCredentials, hashPassword } = await import("../auth");
const { localToUtc, TIME_ZONE } = await import("../time");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `flow_${run}_${name}`;
const DAY = "2031-05-05"; // a Monday, far in the future
const guest = (serviceIds: string[], minute: number, name = "Marko") => ({
  serviceIds, dateIso: DAY, minute, workerId: null, clientName: name, clientPhone: "0641234567", note: "",
});
const online = { source: "ONLINE" as const, createdById: null, clientId: null };

async function cleanup(): Promise<void> {
  await ownerDb.appointment.deleteMany({ where: { salonId: id("salon") } });
  await ownerDb.salon.deleteMany({ where: { id: id("salon") } });
  await ownerDb.user.deleteMany({ where: { id: id("owner") } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.create({
    data: { id: id("owner"), email: `${id("owner")}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: await hashPassword("tajna-lozinka") },
  });
  await ownerDb.salon.create({
    data: { id: id("salon"), name: "Test", slug: id("salon"), city: "Niš", address: "Ulica 1", ownerId: id("owner"), cancelCutoffHours: 2 },
  });
  await ownerDb.workingHours.create({ data: { salonId: id("salon"), dayOfWeek: 1, opensAt: 9 * 60, closesAt: 19 * 60 } });
  await ownerDb.workerProfile.create({ data: { id: id("w"), salonId: id("salon"), displayName: "Olgica" } });
  await ownerDb.service.createMany({
    data: [
      { id: id("cut"), salonId: id("salon"), name: "Šišanje", price: 60000, durationMinutes: 30 },
      { id: id("beard"), salonId: id("salon"), name: "Brada", price: 20000, comboPrice: 0, durationMinutes: 10 },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await ownerDb.$disconnect();
});

describe("booking and cancelling", () => {
  it("books a combo: one price, summed length, and the slot is gone afterwards", async () => {
    const res = await createAppointment(id("salon"), guest([id("cut"), id("beard")], 10 * 60), online);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = await ownerDb.appointment.findUniqueOrThrow({ where: { id: res.appointmentId }, include: { services: true } });
    expect(a.price).toBe(60000); // beard is free next to a haircut
    expect(a.endTime.getTime() - a.startTime.getTime()).toBe(40 * 60_000);
    expect(a.status).toBe("BOOKED");
    const slots = await getAvailableSlots({ salonId: id("salon"), durationMinutes: 30, dateIso: DAY, workerId: null, enforceLeadTime: false });
    expect(slots.some((s) => s.minute === 10 * 60)).toBe(false);
  });

  it("books a single service at its normal price (another day, so no combo with the haircut above)", async () => {
    const res = await createAppointment(id("salon"), { ...guest([id("beard")], 12 * 60), dateIso: "2031-05-12" }, online);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = await ownerDb.appointment.findUniqueOrThrow({ where: { id: res.appointmentId } });
    expect(a.price).toBe(20000);
  });

  it("refuses an unknown service", async () => {
    const res = await createAppointment(id("salon"), guest(["nema-takve"], 14 * 60), online);
    expect(res.ok).toBe(false);
  });

  it("cancels with the personal link, frees the time, and cannot cancel twice", async () => {
    const res = await createAppointment(id("salon"), guest([id("cut")], 15 * 60), online);
    if (!res.ok) throw new Error(res.error);
    expect(await cancelByCustomer(res.manageToken)).toEqual({ ok: true });
    const a = await ownerDb.appointment.findUniqueOrThrow({ where: { id: res.appointmentId } });
    expect(a.status).toBe("CANCELLED");
    expect((await cancelByCustomer(res.manageToken)).ok).toBe(false);
    const again = await createAppointment(id("salon"), guest([id("cut")], 15 * 60, "Petar"), online);
    expect(again.ok).toBe(true);
  });

  it("refuses to cancel inside the salon's cutoff window, and an unknown link", async () => {
    const res = await createAppointment(id("salon"), guest([id("cut")], 17 * 60), online);
    if (!res.ok) throw new Error(res.error);
    // Pretend the visit is in 1 hour while the cutoff is 2 hours.
    await ownerDb.appointment.update({
      where: { id: res.appointmentId },
      data: { startTime: new Date(Date.now() + 3_600_000), endTime: new Date(Date.now() + 5_400_000) },
    });
    expect((await cancelByCustomer(res.manageToken)).ok).toBe(false);
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { id: res.appointmentId } })).status).toBe("BOOKED");
    expect((await cancelByCustomer("nepostojeci-token")).ok).toBe(false);
  });
});

describe("sign in", () => {
  const email = `${id("owner")}@test.rs`;
  it("accepts the right password, in any letter case of the email", async () => {
    const user = await verifyCredentials(email.toUpperCase(), "tajna-lozinka");
    expect(user?.id).toBe(id("owner"));
  });
  it("refuses a wrong password, an unknown account and garbage", async () => {
    expect(await verifyCredentials(email, "pogresna")).toBeNull();
    expect(await verifyCredentials("niko@test.rs", "tajna-lozinka")).toBeNull();
    expect(await verifyCredentials("nije mejl", "tajna-lozinka")).toBeNull();
  });
});
