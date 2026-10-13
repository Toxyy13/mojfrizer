// "Hitna rezervacija" through chat, run with Row Level Security enforced: the customer's request opens the chat and
// staff logins only see it when it is addressed to them or to anyone.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.RLS_ENFORCE = "1";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

vi.mock("../mail", () => ({ sendMail: vi.fn(async () => true) }));

const { db, ownerDb } = await import("../db");
const { runAsUser } = await import("../rls");
const { startUrgentChat, urgentClientIdsForStaff } = await import("../urgentChat");
const { addMessage, loadConversation } = await import("../chat");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `uc_${run}_${name}`;
const ids = {
  owner: id("owner"),
  staffA: id("staffA"),
  staffB: id("staffB"),
  client: id("client"),
  salon: id("salon"),
  workerA: id("workerA"),
  workerB: id("workerB"),
  service: id("service"),
};
const DAY = "2031-05-05";

async function cleanup(): Promise<void> {
  await ownerDb.chatMessage.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.urgentRequest.deleteMany({ where: { salonId: ids.salon } });
  await ownerDb.salon.deleteMany({ where: { id: ids.salon } });
  await ownerDb.user.deleteMany({ where: { id: { startsWith: `uc_${run}_` } } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.createMany({
    data: [
      { id: ids.owner, email: `${ids.owner}@test.rs`, name: "Vlasnik", role: "ADMIN", passwordHash: "x" },
      { id: ids.staffA, email: `${ids.staffA}@test.rs`, name: "Radnik A", role: "ADMIN", passwordHash: "x" },
      { id: ids.staffB, email: `${ids.staffB}@test.rs`, name: "Radnik B", role: "ADMIN", passwordHash: "x" },
      { id: ids.client, email: `${ids.client}@test.rs`, name: "Mušterija", role: "CLIENT", passwordHash: "x" },
    ],
  });
  await ownerDb.salon.create({ data: { id: ids.salon, name: ids.salon, slug: ids.salon, city: "Niš", address: "Ulica 1", ownerId: ids.owner, urgentSurcharge: 50000 } });
  await ownerDb.workerProfile.createMany({
    data: [
      { id: ids.workerA, salonId: ids.salon, userId: ids.staffA, displayName: "Radnik A" },
      { id: ids.workerB, salonId: ids.salon, userId: ids.staffB, displayName: "Radnik B" },
    ],
  });
  await ownerDb.service.create({ data: { id: ids.service, salonId: ids.salon, name: "Šišanje", price: 60000, durationMinutes: 30 } });
});

afterAll(async () => {
  await cleanup();
  await ownerDb.$disconnect();
});

describe("urgent booking chat", () => {
  it("opens the chat with the request as first message and reuses it for a second click", async () => {
    const customer = { id: ids.client, name: "Mušterija", phone: null };
    const input = { serviceIds: [ids.service], workerId: ids.workerA, dateIso: DAY, timeWish: "posle 17h", reason: "Venčanje večeras" };
    expect(await runAsUser(ids.client, () => startUrgentChat(ids.salon, customer, input))).toEqual({ ok: true });
    expect(await runAsUser(ids.client, () => startUrgentChat(ids.salon, customer, input))).toEqual({ ok: true });
    const chat = await runAsUser(ids.client, () => loadConversation(ids.salon, ids.client));
    expect(chat).toHaveLength(1);
    expect(chat[0].text).toContain("HITNA REZERVACIJA");
    expect(chat[0].text).toContain("Radnik A");
    expect(chat[0].text).toContain("posle 17h");
    expect(await ownerDb.urgentRequest.count({ where: { salonId: ids.salon } })).toBe(1);
  });

  it("is visible to the owner and the addressed staff member only", async () => {
    expect(await runAsUser(ids.owner, () => db.chatMessage.count({ where: { salonId: ids.salon } }))).toBe(1);
    expect(await runAsUser(ids.staffA, () => db.chatMessage.count({ where: { salonId: ids.salon } }))).toBe(1);
    expect(await runAsUser(ids.staffB, () => db.chatMessage.count({ where: { salonId: ids.salon } }))).toBe(0);
    expect(await runAsUser(ids.staffA, () => urgentClientIdsForStaff(ids.salon, ids.workerA))).toEqual([ids.client]);
    expect(await runAsUser(ids.staffB, () => urgentClientIdsForStaff(ids.salon, ids.workerB))).toEqual([]);
  });

  it("lets the addressed staff member answer, but not the other one", async () => {
    await runAsUser(ids.staffA, () => addMessage({ salonId: ids.salon, clientId: ids.client, senderId: ids.staffA, fromSalon: true, text: "Dođite u 18h" }));
    await expect(
      runAsUser(ids.staffB, () => addMessage({ salonId: ids.salon, clientId: ids.client, senderId: ids.staffB, fromSalon: true, text: "Ja ne smem" })),
    ).rejects.toThrow();
    expect(await ownerDb.chatMessage.count({ where: { salonId: ids.salon } })).toBe(2);
  });

  it("shows a request addressed to anyone to every staff member, and hides it once resolved", async () => {
    await ownerDb.urgentRequest.updateMany({ where: { salonId: ids.salon }, data: { workerId: null } });
    expect(await runAsUser(ids.staffB, () => db.chatMessage.count({ where: { salonId: ids.salon } }))).toBe(2);
    await ownerDb.urgentRequest.updateMany({ where: { salonId: ids.salon }, data: { status: "RESOLVED" } });
    expect(await runAsUser(ids.staffB, () => db.chatMessage.count({ where: { salonId: ids.salon } }))).toBe(0);
    expect(await runAsUser(ids.owner, () => db.chatMessage.count({ where: { salonId: ids.salon } }))).toBe(2);
  });
});
