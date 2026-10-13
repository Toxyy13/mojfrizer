// A booking blocks its whole length for that hairdresser: a 45 min visit at 18:00 blocks 18:00-18:45 in every path
// (slots, customer booking, owner booking, reschedule, urgent swap, time off), also when two requests race.
// Runs against real PostgreSQL, so the appointments_no_overlap constraint is part of what is tested.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";
vi.mock("../mail", () => ({ sendMail: vi.fn(async () => true) }));

const { ownerDb } = await import("../db");
const { createAppointment, getAvailableSlots } = await import("../booking");
const { rescheduleByCustomer } = await import("../manageBooking");
const { swapForUrgentRequest } = await import("../urgent");
const { localToUtc, TIME_ZONE } = await import("../time");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `ovl_${run}_${name}`;
const ids = {
  owner: id("owner"),
  salon: id("salon"),
  w1: id("w1"),
  w2: id("w2"),
  s30: id("s30"),
  s15: id("s15"),
  s20: id("s20"),
  s45: id("s45"),
};
const DAY = "2031-05-05"; // a Monday, far in the future
const h = (hour: number, min = 0): number => hour * 60 + min;
const t = (hour: number, min = 0): Date => localToUtc(DAY, h(hour, min), TIME_ZONE);

async function cleanup(): Promise<void> {
  await ownerDb.urgentRequest.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.appointment.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.salon.deleteMany({ where: { id: ids.salon } });
  await ownerDb.user.deleteMany({ where: { id: ids.owner } });
}

async function wipeBookings(): Promise<void> {
  await ownerDb.urgentRequest.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.appointment.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.workerTimeOff.deleteMany({ where: { salonId: ids.salon } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.create({
    data: { id: ids.owner, email: `${ids.owner}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: "x" },
  });
  await ownerDb.salon.create({
    data: { id: ids.salon, name: "Test", slug: ids.salon, city: "Niš", address: "Ulica 1", ownerId: ids.owner, cancelCutoffHours: 0 },
  });
  await ownerDb.workingHours.create({ data: { salonId: ids.salon, dayOfWeek: 1, opensAt: h(9), closesAt: h(21) } });
  await ownerDb.workerProfile.create({ data: { id: ids.w1, salonId: ids.salon, displayName: "Frizer 1" } });
  await ownerDb.service.createMany({
    data: [
      { id: ids.s30, salonId: ids.salon, name: "Šišanje", price: 60000, durationMinutes: 30 },
      { id: ids.s15, salonId: ids.salon, name: "Brijanje", price: 15000, durationMinutes: 15 },
      { id: ids.s20, salonId: ids.salon, name: "Pranje", price: 15000, durationMinutes: 20 },
      { id: ids.s45, salonId: ids.salon, name: "Farbanje", price: 200000, durationMinutes: 45 },
    ],
  });
  // Cut + shave together take 45 minutes at this salon (combo), not the 30 + 15 sum by chance: use a shorter combo too.
  await ownerDb.serviceCombo.create({
    data: { salonId: ids.salon, serviceIds: [ids.s20, ids.s15].sort(), durationMinutes: 45 },
  });
});

afterAll(async () => {
  await cleanup();
  await ownerDb.$disconnect();
});

const guest = (serviceIds: string[], minute: number, workerId: string | null = null) => ({
  serviceIds,
  workerId,
  dateIso: DAY,
  minute,
  clientName: "Gost Gostić",
  clientPhone: "064 111 2233",
  note: null,
});
const online = { source: "ONLINE" as const, createdById: null, clientId: null };
const owner = { source: "SALON" as const, createdById: ids.owner, clientId: null };

const slotMinutes = async (serviceIds: string[], workerId: string | null = null): Promise<number[]> =>
  (await getAvailableSlots({ salonId: ids.salon, dateIso: DAY, serviceIds, workerId, enforceLeadTime: false })).map((s) => s.minute);

describe("a 45 minute booking at 18:00", () => {
  it("blocks 18:00-18:45 and nothing else, for services of any length", async () => {
    await wipeBookings();
    expect((await createAppointment(ids.salon, guest([ids.s45], h(18)), online)).ok).toBe(true);

    const short = await slotMinutes([ids.s15]); // 15 min
    for (const m of [h(18), h(18, 15), h(18, 30)]) expect(short).not.toContain(m);
    expect(short).toContain(h(17, 45)); // ends exactly at 18:00
    expect(short).toContain(h(18, 45)); // starts exactly when the 45 min visit ends

    const medium = await slotMinutes([ids.s30]); // 30 min must not run into 18:00
    expect(medium).toContain(h(17, 30));
    for (const m of [h(17, 45), h(18), h(18, 15), h(18, 30)]) expect(medium).not.toContain(m);
    expect(medium).toContain(h(18, 45));

    const long = await slotMinutes([ids.s45]); // a 45 min visit must not run into it either
    expect(long).toContain(h(17, 15));
    for (const m of [h(17, 30), h(17, 45), h(18), h(18, 15), h(18, 30)]) expect(long).not.toContain(m);
    expect(long).toContain(h(18, 45));
  });

  it("is also blocked when the 45 minutes come from a service combo", async () => {
    await wipeBookings();
    const combo = await createAppointment(ids.salon, guest([ids.s20, ids.s15], h(18)), online);
    expect(combo.ok).toBe(true);
    const a = await ownerDb.appointment.findFirstOrThrow({ where: { salonId: ids.salon } });
    expect(a.endTime.getTime() - a.startTime.getTime()).toBe(45 * 60_000);
    expect(await slotMinutes([ids.s15])).not.toContain(h(18, 30));
    expect(await slotMinutes([ids.s15])).toContain(h(18, 45));
  });

  it("rejects customer and owner bookings that overlap it, accepts the ones that touch it", async () => {
    await wipeBookings();
    expect((await createAppointment(ids.salon, guest([ids.s45], h(18)), online)).ok).toBe(true);
    for (const m of [h(17, 45), h(18), h(18, 15), h(18, 30)]) {
      expect((await createAppointment(ids.salon, guest([ids.s30], m), online)).ok, `online ${m}`).toBe(false);
      expect((await createAppointment(ids.salon, guest([ids.s30], m), owner)).ok, `owner ${m}`).toBe(false);
    }
    expect((await createAppointment(ids.salon, guest([ids.s30], h(17)), owner)).ok).toBe(true); // 17:00-17:30
    expect((await createAppointment(ids.salon, guest([ids.s15], h(18, 45)), owner)).ok).toBe(true);
    expect((await createAppointment(ids.salon, guest([ids.s30], h(17, 30)), owner)).ok).toBe(true); // 17:30-18:00
  });

  it("is a per-hairdresser block: a second hairdresser can still take the time", async () => {
    await wipeBookings();
    await ownerDb.workerProfile.create({ data: { id: ids.w2, salonId: ids.salon, displayName: "Frizer 2" } });
    try {
      expect((await createAppointment(ids.salon, guest([ids.s45], h(18), ids.w1), online)).ok).toBe(true);
      expect((await createAppointment(ids.salon, guest([ids.s30], h(18, 15), ids.w1), online)).ok).toBe(false);
      expect(await slotMinutes([ids.s30], ids.w1)).not.toContain(h(18, 15));
      expect(await slotMinutes([ids.s30], ids.w2)).toContain(h(18, 15));
      // Without choosing, the customer gets the free hairdresser.
      const other = await createAppointment(ids.salon, guest([ids.s30], h(18, 15)), online);
      expect(other.ok).toBe(true);
      const row = await ownerDb.appointment.findFirstOrThrow({ where: { salonId: ids.salon, startTime: t(18, 15) } });
      expect(row.workerId).toBe(ids.w2);
    } finally {
      await wipeBookings();
      await ownerDb.workerProfile.delete({ where: { id: ids.w2 } });
    }
  });

  it("a cancelled booking frees the time again", async () => {
    await wipeBookings();
    const first = await createAppointment(ids.salon, guest([ids.s45], h(18)), online);
    expect(first.ok).toBe(true);
    await ownerDb.appointment.updateMany({ where: { salonId: ids.salon }, data: { status: "CANCELLED" } });
    expect(await slotMinutes([ids.s30])).toContain(h(18, 15));
    expect((await createAppointment(ids.salon, guest([ids.s30], h(18, 15)), online)).ok).toBe(true);
  });

  it("two requests at the same moment: exactly one wins", async () => {
    await wipeBookings();
    const results = await Promise.all(
      [h(18), h(18, 15), h(18, 30), h(18), h(18, 15)].map((m) => createAppointment(ids.salon, guest([ids.s45], m), online)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await ownerDb.appointment.count({ where: { salonId: ids.salon } })).toBe(1);
  });

  it("the database itself refuses an overlap, even when the app checks are bypassed", async () => {
    await wipeBookings();
    const base = { salonId: ids.salon, workerId: ids.w1, serviceId: ids.s45, guestName: "A", guestPhone: "1", source: "SALON" as const, price: 1 };
    await ownerDb.appointment.create({ data: { ...base, startTime: t(18), endTime: t(18, 45) } });
    await expect(ownerDb.appointment.create({ data: { ...base, startTime: t(18, 30), endTime: t(19, 15) } })).rejects.toThrow();
    await expect(ownerDb.appointment.create({ data: { ...base, startTime: t(17, 30), endTime: t(18, 15) } })).rejects.toThrow();
    await expect(ownerDb.appointment.create({ data: { ...base, startTime: t(18, 10), endTime: t(18, 20) } })).rejects.toThrow();
    await ownerDb.appointment.create({ data: { ...base, startTime: t(18, 45), endTime: t(19, 15) } });
  });

  it("time off (absence) blocks the same way", async () => {
    await wipeBookings();
    await ownerDb.workerTimeOff.create({ data: { salonId: ids.salon, workerId: ids.w1, startTime: t(18), endTime: t(18, 45) } });
    expect(await slotMinutes([ids.s30])).not.toContain(h(17, 45));
    expect(await slotMinutes([ids.s30])).not.toContain(h(18, 30));
    expect(await slotMinutes([ids.s30])).toContain(h(18, 45));
    expect((await createAppointment(ids.salon, guest([ids.s15], h(18, 15)), owner)).ok).toBe(false);
  });
});

describe("moving a booking", () => {
  it("a customer cannot move their booking into a 45 minute booking, but can into a free gap", async () => {
    await wipeBookings();
    expect((await createAppointment(ids.salon, guest([ids.s45], h(18)), online)).ok).toBe(true);
    const mine = await createAppointment(ids.salon, guest([ids.s30], h(12)), online);
    if (!mine.ok) throw new Error("setup");
    for (const m of [h(17, 45), h(18), h(18, 15), h(18, 30)]) {
      expect((await rescheduleByCustomer(mine.manageToken, DAY, m)).ok, `move ${m}`).toBe(false);
    }
    const after = await ownerDb.appointment.findUniqueOrThrow({ where: { manageToken: mine.manageToken } });
    expect(after.startTime).toEqual(t(12));
    expect((await rescheduleByCustomer(mine.manageToken, DAY, h(18, 45))).ok).toBe(true);
  });

  it("urgent swap is refused when the urgent visit would run into the next booking", async () => {
    await wipeBookings();
    const first = await createAppointment(ids.salon, guest([ids.s30], h(18)), owner); // 18:00-18:30
    expect(first.ok).toBe(true);
    expect((await createAppointment(ids.salon, guest([ids.s30], h(18, 30)), owner)).ok).toBe(true); // 18:30-19:00
    const booked = await ownerDb.appointment.findFirstOrThrow({ where: { salonId: ids.salon, startTime: t(18) } });
    const req = await ownerDb.urgentRequest.create({
      data: {
        salonId: ids.salon,
        serviceId: ids.s45,
        serviceIds: [ids.s45],
        guestName: "Hitan",
        guestPhone: "064 000 000",
        date: new Date(`${DAY}T00:00:00Z`),
        reason: "Venčanje",
      },
    });
    const result = await swapForUrgentRequest(ids.salon, ids.owner, {
      requestId: req.id,
      appointmentId: booked.id,
      newDateIso: DAY,
      newTime: "20:00",
    });
    expect(result.ok).toBe(false); // 45 min at 18:00 would run into the 18:30 booking
    // Nothing changed: the booked customer is still at 18:00.
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { id: booked.id } })).startTime).toEqual(t(18));
    expect(await ownerDb.appointment.count({ where: { salonId: ids.salon } })).toBe(2);
  });
});
