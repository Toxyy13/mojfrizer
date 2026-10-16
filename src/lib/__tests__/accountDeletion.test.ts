// Deleting an account end to end: the person disappears everywhere, the salon keeps only anonymous books.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

const { systemDb: db } = await import("../db");
const { deleteAccount, DELETED_NAME } = await import("../accountDeletion");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `del_${run}_${name}`;
const ids = { owner: id("owner"), client: id("client"), salon: id("salon"), worker: id("worker"), service: id("service"), past: id("past"), future: id("future"), review: id("review") };
const PHONE = "+38164" + String(Math.floor(1000000 + Math.random() * 8999999));
const DAY = 86_400_000;

async function cleanup(): Promise<void> {
  await db.chatMessage.deleteMany({ where: { salonId: ids.salon } });
  await db.salon.deleteMany({ where: { id: ids.salon } });
  await db.user.deleteMany({ where: { id: { startsWith: `del_${run}_` } } });
}

beforeAll(async () => {
  await cleanup();
  await db.user.createMany({
    data: [
      { id: ids.owner, email: `${ids.owner}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: "x" },
      { id: ids.client, email: `${ids.client}@test.rs`, name: "Marko Markovic", role: "CLIENT", passwordHash: "x", phone: PHONE, googleId: `g_${run}` },
    ],
  });
  await db.salon.create({ data: { id: ids.salon, name: "S", slug: `del-${run}`, city: "Niš", address: "A 1", ownerId: ids.owner } });
  await db.workerProfile.create({ data: { id: ids.worker, salonId: ids.salon, displayName: "W" } });
  await db.service.create({ data: { id: ids.service, salonId: ids.salon, name: "Šišanje", price: 60000, durationMinutes: 30 } });
  const base = { salonId: ids.salon, workerId: ids.worker, serviceId: ids.service, clientId: ids.client, source: "ONLINE" as const, price: 60000, guestName: "Marko Markovic", guestPhone: PHONE, note: "alergija" };
  await db.appointment.create({ data: { ...base, id: ids.past, status: "COMPLETED", startTime: new Date(Date.now() - 10 * DAY), endTime: new Date(Date.now() - 10 * DAY + 1_800_000) } });
  await db.appointment.create({ data: { ...base, id: ids.future, startTime: new Date(Date.now() + 10 * DAY), endTime: new Date(Date.now() + 10 * DAY + 1_800_000) } });
  await db.review.create({ data: { id: ids.review, salonId: ids.salon, appointmentId: ids.past, clientId: ids.client, authorName: "Marko", rating: 5, comment: "super" } });
  await db.chatMessage.createMany({
    data: [
      { salonId: ids.salon, clientId: ids.client, senderId: ids.client, fromSalon: false, text: "zdravo" },
      { salonId: ids.salon, clientId: ids.client, senderId: ids.owner, fromSalon: true, text: "dobar dan" },
    ],
  });
  await db.waitlistEntry.create({ data: { salonId: ids.salon, clientId: ids.client, serviceId: ids.service, date: new Date(Date.now() + 3 * DAY) } });
  await db.userAvatar.create({ data: { userId: ids.client, mime: "image/png", data: Buffer.from([1, 2, 3]) } });
  await db.salonClientNote.create({ data: { salonId: ids.salon, clientKey: `u:${ids.client}`, note: "stalna mušterija" } });
  await db.salonClientNote.create({ data: { salonId: ids.salon, clientKey: `p:${PHONE.replace(/\D/g, "").slice(-8)}`, note: "po telefonu" } });
  await db.emailToken.create({ data: { userId: ids.client, kind: "RESET_PASSWORD", tokenHash: `h_${run}`, expiresAt: new Date(Date.now() + DAY) } });
  await db.salonMembership.create({ data: { userId: ids.client, salonId: ids.salon } });
});

afterAll(async () => {
  await cleanup();
});

describe("deleteAccount", () => {
  it("refuses to delete a salon owner", async () => {
    const result = await deleteAccount(ids.owner);
    expect(result.ok).toBe(false);
    expect(await db.user.count({ where: { id: ids.owner } })).toBe(1);
  });

  it("removes the person everywhere and keeps only anonymous salon records", async () => {
    expect(await deleteAccount(ids.client)).toEqual({ ok: true });

    expect(await db.user.count({ where: { id: ids.client } })).toBe(0);
    expect(await db.userAvatar.count({ where: { userId: ids.client } })).toBe(0);
    expect(await db.emailToken.count({ where: { userId: ids.client } })).toBe(0);
    expect(await db.waitlistEntry.count({ where: { salonId: ids.salon } })).toBe(0);
    expect(await db.chatMessage.count({ where: { salonId: ids.salon } })).toBe(0);
    expect(await db.salonClientNote.count({ where: { salonId: ids.salon } })).toBe(0);
    expect(await db.salonMembership.count({ where: { salonId: ids.salon } })).toBe(0);

    const past = await db.appointment.findUniqueOrThrow({ where: { id: ids.past } });
    expect(past).toMatchObject({ clientId: null, guestName: DELETED_NAME, guestPhone: null, note: null, status: "COMPLETED", price: 60000 });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: ids.future } })).status).toBe("CANCELLED");
    expect(await db.review.findUniqueOrThrow({ where: { id: ids.review } })).toMatchObject({ clientId: null, authorName: "Mušterija" });
  });

  it("answers cleanly for an account that is already gone", async () => {
    expect(await deleteAccount(ids.client)).toMatchObject({ ok: false });
  });
});
