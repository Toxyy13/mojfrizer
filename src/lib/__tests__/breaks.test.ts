// Worker breaks: slot generation honours recurring and one-off breaks, and only the owner can change them.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.RLS_ENFORCE = "1";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

const { db, ownerDb } = await import("../db");
const { runAsUser } = await import("../rls");
const { getAvailableSlots, createAppointment } = await import("../booking");
const { appointmentsInBreak, breakIntervalsForDay } = await import("../breaks");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `brk_${run}_${name}`;
const ids = {
  owner: id("owner"),
  staff: id("staff"),
  salon: id("salon"),
  profile: id("profile"),
  other: id("other"),
  short: id("short"),
  long: id("long"),
};
const MONDAY = "2031-05-05";
const TUESDAY = "2031-05-06";
const LUNCH = { startMinute: 13 * 60, endMinute: 13 * 60 + 30 };

async function cleanup(): Promise<void> {
  await ownerDb.appointment.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.salon.deleteMany({ where: { id: ids.salon } });
  await ownerDb.user.deleteMany({ where: { id: { startsWith: `brk_${run}_` } } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.createMany({
    data: [
      { id: ids.owner, email: `${ids.owner}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: "x" },
      { id: ids.staff, email: `${ids.staff}@test.rs`, name: "Radnik", role: "WORKER", passwordHash: "x" },
    ],
  });
  await ownerDb.salon.create({ data: { id: ids.salon, name: "Pauze", slug: ids.salon, city: "Niš", address: "U 1", ownerId: ids.owner } });
  for (const dayOfWeek of [1, 2]) {
    await ownerDb.workingHours.create({ data: { salonId: ids.salon, dayOfWeek, opensAt: 540, closesAt: 1020 } });
  }
  await ownerDb.workerProfile.create({ data: { id: ids.profile, salonId: ids.salon, displayName: "Frizer", userId: ids.staff } });
  await ownerDb.workerProfile.create({ data: { id: ids.other, salonId: ids.salon, displayName: "Drugi" } });
  await ownerDb.service.create({ data: { id: ids.short, salonId: ids.salon, name: "Šišanje", price: 60000, durationMinutes: 30 } });
  await ownerDb.service.create({ data: { id: ids.long, salonId: ids.salon, name: "Farbanje", price: 200000, durationMinutes: 45 } });
  await ownerDb.workerBreak.create({ data: { salonId: ids.salon, workerId: ids.profile, ...LUNCH, weekdays: [1], label: "Ručak" } });
});

afterAll(async () => {
  await cleanup();
  await ownerDb.$disconnect();
});

const slotsFor = (dateIso: string, serviceId: string, workerId: string) =>
  getAvailableSlots({ salonId: ids.salon, dateIso, serviceIds: [serviceId], workerId, enforceLeadTime: false });

describe("slots with breaks", () => {
  it("removes slots inside a recurring break on its weekday only", async () => {
    const monday = (await slotsFor(MONDAY, ids.short, ids.profile)).map((s) => s.minute);
    expect(monday).toContain(12 * 60 + 30); // ends exactly when the break starts
    expect(monday).not.toContain(13 * 60);
    expect(monday).not.toContain(12 * 60 + 45); // would run into the break
    expect(monday).toContain(13 * 60 + 30);
    const tuesday = (await slotsFor(TUESDAY, ids.short, ids.profile)).map((s) => s.minute);
    expect(tuesday).toContain(13 * 60);
  });

  it("does not fit a 45 min service across a break", async () => {
    const monday = (await slotsFor(MONDAY, ids.long, ids.profile)).map((s) => s.minute);
    expect(monday).toContain(12 * 60 + 15); // 12:15-13:00
    expect(monday).not.toContain(12 * 60 + 30);
    expect(monday).not.toContain(13 * 60 + 15 - 30);
    expect(monday).toContain(13 * 60 + 30);
  });

  it("does not block other workers", async () => {
    const other = (await slotsFor(MONDAY, ids.short, ids.other)).map((s) => s.minute);
    expect(other).toContain(13 * 60);
  });

  it("rejects booking into a break", async () => {
    const result = await createAppointment(
      ids.salon,
      { serviceIds: [ids.short], workerId: ids.profile, dateIso: MONDAY, minute: 13 * 60, clientName: "Gost Gostić", clientPhone: "064 111 2233", note: null },
      { source: "ONLINE", createdById: null, clientId: null },
    );
    expect(result.ok).toBe(false);
  });

  it("applies a one-off break to its date only", async () => {
    await ownerDb.workerBreak.create({
      data: { salonId: ids.salon, workerId: ids.other, startMinute: 600, endMinute: 660, weekdays: [], date: new Date(`${TUESDAY}T00:00:00Z`) },
    });
    const tue = (await slotsFor(TUESDAY, ids.short, ids.other)).map((s) => s.minute);
    expect(tue).not.toContain(600);
    expect(tue).toContain(660);
    const mon = (await slotsFor(MONDAY, ids.short, ids.other)).map((s) => s.minute);
    expect(mon).toContain(600);
  });
});

describe("break rules", () => {
  it("finds booked visits cut by a break", () => {
    const rule = { workerId: ids.profile, ...LUNCH, weekdays: [1], date: null };
    const inside = { startTime: new Date("2031-05-05T11:15:00Z"), endTime: new Date("2031-05-05T11:45:00Z") }; // 13:15 local
    const outside = { startTime: new Date("2031-05-05T08:00:00Z"), endTime: new Date("2031-05-05T08:30:00Z") };
    expect(appointmentsInBreak(rule, [inside, outside])).toEqual([inside]);
    expect(breakIntervalsForDay([rule], TUESDAY)).toEqual([]);
  });

  it("lets salon staff read but not change breaks (owner only)", async () => {
    const asStaff = <T,>(fn: () => Promise<T>) => runAsUser(ids.staff, fn);
    expect(await asStaff(() => db.workerBreak.count({ where: { salonId: ids.salon } }))).toBeGreaterThan(0);
    await expect(
      asStaff(() => db.workerBreak.create({ data: { salonId: ids.salon, workerId: ids.profile, startMinute: 600, endMinute: 630, weekdays: [3] } })),
    ).rejects.toThrow();
    const removed = await asStaff(() => db.workerBreak.deleteMany({ where: { salonId: ids.salon } }));
    expect(removed.count).toBe(0);
    const asOwner = <T,>(fn: () => Promise<T>) => runAsUser(ids.owner, fn);
    const created = await asOwner(() => db.workerBreak.create({ data: { salonId: ids.salon, workerId: ids.profile, startMinute: 900, endMinute: 915, weekdays: [3] } }));
    expect(created.id).toBeTruthy();
  });
});
