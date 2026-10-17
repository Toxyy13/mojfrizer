// Salon staff move a booking with the same overlap guard as everything else; a staff login stays on its own schedule.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

const { ownerDb } = await import("../db");
const { moveBooking } = await import("../manageBooking");
const { localToUtc, TIME_ZONE } = await import("../time");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `mv_${run}_${name}`;
const DAY = "2031-05-05"; // a Monday, far in the future
const t = (hour: number): Date => localToUtc(DAY, hour * 60, TIME_ZONE);
const opts = { enforceLeadTime: false };

async function cleanup(): Promise<void> {
  await ownerDb.appointment.deleteMany({ where: { salonId: id("salon") } });
  await ownerDb.salon.deleteMany({ where: { id: id("salon") } });
  await ownerDb.user.deleteMany({ where: { id: id("owner") } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.create({ data: { id: id("owner"), email: `${id("owner")}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: "x" } });
  await ownerDb.salon.create({ data: { id: id("salon"), name: "Test", slug: id("salon"), city: "Niš", address: "Ulica 1", ownerId: id("owner") } });
  await ownerDb.workingHours.create({ data: { salonId: id("salon"), dayOfWeek: 1, opensAt: 9 * 60, closesAt: 17 * 60 } });
  await ownerDb.workerProfile.createMany({
    data: [
      { id: id("w1"), salonId: id("salon"), displayName: "Frizer 1" },
      { id: id("w2"), salonId: id("salon"), displayName: "Frizer 2" },
    ],
  });
  await ownerDb.service.create({ data: { id: id("svc"), salonId: id("salon"), name: "Šišanje", price: 60000, durationMinutes: 60 } });
});
afterAll(cleanup);

const book = (worker: string, hour: number) =>
  ownerDb.appointment.create({
    data: { salonId: id("salon"), workerId: worker, serviceId: id("svc"), guestName: "Gost", source: "SALON", startTime: t(hour), endTime: t(hour + 1), price: 60000 },
  });

describe("moveBooking", () => {
  it("moves to a free time", async () => {
    const a = await book(id("w1"), 9);
    expect(await moveBooking(a, DAY, 11 * 60, { ...opts, onlyWorkerId: id("w1") })).toEqual({ ok: true });
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { id: a.id } })).startTime).toEqual(t(11));
  });

  it("refuses a time the hairdresser already has booked", async () => {
    await book(id("w1"), 14);
    const a = await book(id("w1"), 12);
    const r = await moveBooking(a, DAY, 14 * 60, { ...opts, onlyWorkerId: id("w1") });
    expect(r.ok).toBe(false);
  });

  it("a staff login never lands in another hairdresser's schedule", async () => {
    await book(id("w1"), 15);
    const a = await book(id("w1"), 13);
    // w1 is busy at 15; w2 is free, but the staff move is limited to w1.
    expect((await moveBooking(a, DAY, 15 * 60, { ...opts, onlyWorkerId: id("w1") })).ok).toBe(false);
    // The owner (no limit) may hand it to the free hairdresser.
    expect((await moveBooking(a, DAY, 15 * 60, { ...opts, onlyWorkerId: null })).ok).toBe(true);
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { id: a.id } })).workerId).toBe(id("w2"));
  });
});
