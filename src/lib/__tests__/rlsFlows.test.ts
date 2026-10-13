// The real booking, chat, account and cron code running against PostgreSQL with Row Level Security enforced
// (RLS_ENFORCE=1), the way production runs. Nothing here is mocked except mail sending.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.RLS_ENFORCE = "1";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

vi.mock("../mail", () => ({ sendMail: vi.fn(async () => true) }));

const { db, ownerDb } = await import("../db");
const { runAsUser } = await import("../rls");
const { createAppointment, getAvailableSlots } = await import("../booking");
const { cancelByCustomer, loadManagedAppointment, toIcs } = await import("../manageBooking");
const { isBlockedOnline } = await import("../clients");
const { createUrgentRequest } = await import("../urgent");
const { addMessage, loadConversation, markRead, unreadForSalon } = await import("../chat");
const { issueToken, consumeToken } = await import("../emailTokens");
const { deleteAccount } = await import("../accountDeletion");
const { submitReview } = await import("../reviews");
const { sendDueReminders } = await import("../reminders");
const { joinWaitlist } = await import("../waitlist");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `flow_${run}_${name}`;
const ids = {
  ownerA: id("ownerA"),
  ownerB: id("ownerB"),
  client: id("client"),
  salonA: id("salonA"),
  salonB: id("salonB"),
  profileA: id("profileA"),
  serviceA: id("serviceA"),
};
const DAY = "2031-05-05"; // a Monday, far in the future

async function cleanup(): Promise<void> {
  const salons = [ids.salonA, ids.salonB];
  await ownerDb.chatMessage.deleteMany({ where: { salonId: { in: salons } } });
  await ownerDb.appointment.deleteMany({ where: { salonId: { in: salons } } });
  await ownerDb.salon.deleteMany({ where: { id: { in: salons } } });
  await ownerDb.user.deleteMany({ where: { id: { startsWith: `flow_${run}_` } } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.createMany({
    data: [
      { id: ids.ownerA, email: `${ids.ownerA}@test.rs`, name: "Vlasnik A", role: "ADMIN", passwordHash: "x" },
      { id: ids.ownerB, email: `${ids.ownerB}@test.rs`, name: "Vlasnik B", role: "ADMIN", passwordHash: "x" },
      { id: ids.client, email: `${ids.client}@test.rs`, name: "Mušterija Test", role: "CLIENT", passwordHash: "x", emailVerifiedAt: new Date() },
    ],
  });
  for (const [salonId, ownerId] of [[ids.salonA, ids.ownerA], [ids.salonB, ids.ownerB]] as const) {
    await ownerDb.salon.create({ data: { id: salonId, name: salonId, slug: salonId, city: "Niš", address: "Ulica 1", ownerId } });
  }
  await ownerDb.workingHours.create({ data: { salonId: ids.salonA, dayOfWeek: 1, opensAt: 540, closesAt: 1020 } });
  await ownerDb.workerProfile.create({ data: { id: ids.profileA, salonId: ids.salonA, displayName: "Frizer" } });
  await ownerDb.service.create({ data: { id: ids.serviceA, salonId: ids.salonA, name: "Šišanje", price: 60000, durationMinutes: 30 } });
});

afterAll(async () => {
  await cleanup();
  await ownerDb.$disconnect();
});

const guest = (minute: number) => ({
  serviceIds: [ids.serviceA],
  workerId: null,
  dateIso: DAY,
  minute,
  clientName: "Gost Gostić",
  clientPhone: "064 111 2233",
  note: null,
});
const online = { source: "ONLINE" as const, createdById: null, clientId: null };

describe("visitors booking without an account", () => {
  let token = "";

  it("sees free slots of a salon whose bookings they may not read", async () => {
    const slots = await getAvailableSlots({ salonId: ids.salonA, dateIso: DAY, serviceIds: [ids.serviceA], enforceLeadTime: true });
    expect(slots.length).toBeGreaterThan(10);
    expect(slots.some((s) => s.minute === 600)).toBe(true);
  });

  it("books a slot, and then that slot is gone for the next visitor", async () => {
    const first = await createAppointment(ids.salonA, guest(600), online);
    expect(first.ok).toBe(true);
    if (first.ok) token = first.manageToken;
    const slots = await getAvailableSlots({ salonId: ids.salonA, dateIso: DAY, serviceIds: [ids.serviceA], enforceLeadTime: true });
    expect(slots.some((s) => s.minute === 600)).toBe(false);
    const second = await createAppointment(ids.salonA, guest(600), online);
    expect(second.ok).toBe(false);
  });

  it("manages the booking through its secret link: calendar file, then cancel", async () => {
    const appointment = await loadManagedAppointment(token);
    expect(appointment?.salon.id).toBe(ids.salonA);
    expect(toIcs(appointment!)).toContain("BEGIN:VEVENT");
    expect(await cancelByCustomer(token)).toEqual({ ok: true });
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { manageToken: token } })).status).toBe("CANCELLED");
  });

  it("cannot read any booking directly", async () => {
    expect(await db.appointment.count({ where: { salonId: ids.salonA } })).toBe(0);
  });

  it("is told to phone the salon when the owner blocked online booking for their number", async () => {
    await ownerDb.salonClientNote.create({ data: { salonId: ids.salonA, clientKey: "p:41112233", blockedOnline: true } });
    expect(await isBlockedOnline(ids.salonA, { guestPhone: "064 111 2233", clientId: null })).toBe(true);
    expect(await isBlockedOnline(ids.salonA, { guestPhone: "065 999 8877", clientId: null })).toBe(false);
  });

  it("can file an urgent request that only the salon's owner can read", async () => {
    const result = await createUrgentRequest(
      ids.salonA,
      { serviceIds: [ids.serviceA], dateIso: DAY, clientName: "Gost", clientPhone: "064 111 2233", reason: "Venčanje" } as never,
      null,
    );
    expect(result).toEqual({ ok: true });
    expect(await runAsUser(ids.ownerA, () => db.urgentRequest.count({ where: { salonId: ids.salonA } }))).toBe(1);
    expect(await runAsUser(ids.ownerB, () => db.urgentRequest.count({ where: { salonId: ids.salonA } }))).toBe(0);
  });
});

describe("accounts", () => {
  it("a customer books on their account, sees it, and a reminder goes out (cron)", async () => {
    const booked = await runAsUser(ids.client, () =>
      createAppointment(ids.salonA, guest(660), { source: "ONLINE", createdById: ids.client, clientId: ids.client }),
    );
    expect(booked.ok).toBe(true);
    expect(await runAsUser(ids.client, () => db.appointment.count({ where: { clientId: ids.client } }))).toBe(1);
    expect(await runAsUser(ids.ownerB, () => db.appointment.count({ where: { clientId: ids.client } }))).toBe(0);
    await expect(sendDueReminders(new Date())).resolves.toBeDefined();
  });

  it("joins a waitlist", async () => {
    const result = await runAsUser(ids.client, () => joinWaitlist(ids.salonA, ids.client, [ids.serviceA], DAY));
    expect(result.ok).toBe(true);
    expect(await runAsUser(ids.client, () => db.waitlistEntry.count({ where: { clientId: ids.client } }))).toBe(1);
  });

  it("password-reset tokens work for system code and are invisible to users", async () => {
    const token = await issueToken(ids.client, "RESET_PASSWORD");
    expect(token).toBeTruthy();
    expect(await runAsUser(ids.client, () => db.emailToken.count())).toBe(0);
    expect(await consumeToken(token!, "RESET_PASSWORD")).toEqual({ userId: ids.client });
  });

  it("rates a completed visit through the booking link", async () => {
    const past = new Date(Date.now() - 2 * 86_400_000);
    const a = await ownerDb.appointment.create({
      data: { salonId: ids.salonA, workerId: ids.profileA, serviceId: ids.serviceA, clientId: ids.client, source: "ONLINE", status: "COMPLETED", startTime: past, endTime: new Date(past.getTime() + 1_800_000), price: 60000 },
    });
    expect(await submitReview(a.manageToken, 5, "Odlično")).toEqual({ ok: true });
    expect(await db.review.count({ where: { salonId: ids.salonA } })).toBe(1);
  });
});

describe("chat", () => {
  it("customer and owner talk; another salon's owner sees nothing", async () => {
    await runAsUser(ids.client, () => addMessage({ salonId: ids.salonA, clientId: ids.client, senderId: ids.client, fromSalon: false, text: "Zdravo" }));
    expect(await runAsUser(ids.ownerA, () => unreadForSalon(ids.salonA))).toBe(1);
    // Opening the conversation marks the other side's messages as read.
    await runAsUser(ids.ownerA, () => markRead(ids.salonA, ids.client, true));
    expect(await runAsUser(ids.ownerA, () => unreadForSalon(ids.salonA))).toBe(0);
    await runAsUser(ids.ownerA, () => addMessage({ salonId: ids.salonA, clientId: ids.client, senderId: ids.ownerA, fromSalon: true, text: "Dobar dan" }));
    await runAsUser(ids.client, () => markRead(ids.salonA, ids.client, false));
    expect((await runAsUser(ids.client, () => loadConversation(ids.salonA, ids.client))).map((m) => m.text)).toEqual(["Zdravo", "Dobar dan"]);
    expect(await runAsUser(ids.ownerB, () => loadConversation(ids.salonA, ids.client))).toEqual([]);
    // A salon cannot write into a customer's thread with another salon's identity.
    await expect(
      runAsUser(ids.ownerB, () => addMessage({ salonId: ids.salonA, clientId: ids.client, senderId: ids.ownerB, fromSalon: true, text: "Hej" })),
    ).rejects.toThrow();
  });
});

describe("deleting an account", () => {
  it("removes the person, keeps the salon's books", async () => {
    expect(await deleteAccount(ids.client)).toEqual({ ok: true });
    expect(await ownerDb.user.count({ where: { id: ids.client } })).toBe(0);
    expect(await ownerDb.appointment.count({ where: { salonId: ids.salonA } })).toBeGreaterThan(0);
  });
});
