// The assistant's actions stay inside the asker's own salon / own bookings.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

const { ownerDb } = await import("../db");
const { prepareAction, runAction } = await import("../assistantActions");
const { localToUtc, TIME_ZONE } = await import("../time");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `as_${run}_${name}`;
const start = localToUtc("2031-05-05", 10 * 60, TIME_ZONE);

const owner = { id: id("owner"), email: null, name: "Vlasnik", role: "ADMIN" as const };
const ctx = { user: owner, salon: { id: id("salon"), slug: id("salon"), name: "Moj salon" } };
const client = { id: id("client"), email: null, name: "Ana", role: "CLIENT" as const };

async function cleanup(): Promise<void> {
  await ownerDb.appointment.deleteMany({ where: { salonId: { in: [id("salon"), id("other")] } } });
  await ownerDb.salon.deleteMany({ where: { id: { in: [id("salon"), id("other")] } } });
  await ownerDb.user.deleteMany({ where: { id: { in: [id("owner"), id("owner2"), id("client"), id("client2")] } } });
}

beforeAll(async () => {
  await cleanup();
  for (const [key, role] of [["owner", "ADMIN"], ["owner2", "ADMIN"], ["client", "CLIENT"], ["client2", "CLIENT"]] as const) {
    await ownerDb.user.create({ data: { id: id(key), email: `${id(key)}@test.rs`, name: key, role, passwordHash: "x" } });
  }
  for (const [salon, ownerKey] of [["salon", "owner"], ["other", "owner2"]]) {
    await ownerDb.salon.create({ data: { id: id(salon), name: salon, slug: id(salon), city: "Niš", address: "Ulica 1", ownerId: id(ownerKey) } });
    await ownerDb.workerProfile.create({ data: { id: id(`w-${salon}`), salonId: id(salon), displayName: "Frizer" } });
    await ownerDb.service.create({ data: { id: id(`svc-${salon}`), salonId: id(salon), name: "Šišanje", price: 60000, durationMinutes: 30 } });
  }
  await ownerDb.appointment.create({
    data: {
      id: id("appt-other"), salonId: id("other"), workerId: id("w-other"), serviceId: id("svc-other"), clientId: id("client2"),
      guestName: "Tuđa", source: "SALON", startTime: start, endTime: new Date(start.getTime() + 1_800_000), price: 60000,
    },
  });
});
afterAll(cleanup);

describe("assistant actions respect tenants", () => {
  it("an owner can't touch another salon's service or appointment", async () => {
    const service = await prepareAction(ctx, { type: "set_service", serviceId: id("svc-other"), priceRsd: 1 }, true);
    const appt = await prepareAction(ctx, { type: "salon_status", appointmentId: id("appt-other"), status: "CANCELLED" }, true);
    expect(service.ok).toBe(false);
    expect(appt.ok).toBe(false);
    const result = await runAction(ctx, { type: "salon_status", appointmentId: id("appt-other"), status: "CANCELLED" }, true);
    expect(result.ok).toBe(false);
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { id: id("appt-other") } })).status).toBe("BOOKED");
  });

  it("a customer can't cancel someone else's booking", async () => {
    const customerCtx = { user: client, salon: ctx.salon };
    const r = await runAction(customerCtx, { type: "cancel_mine", appointmentId: id("appt-other") }, false);
    expect(r.ok).toBe(false);
    expect((await ownerDb.appointment.findUniqueOrThrow({ where: { id: id("appt-other") } })).status).toBe("BOOKED");
  });

  it("an owner changes prices only in their own salon", async () => {
    const r = await runAction(ctx, { type: "set_service", serviceId: id("svc-salon"), priceRsd: 700 }, true);
    expect(r.ok).toBe(true);
    expect((await ownerDb.service.findUniqueOrThrow({ where: { id: id("svc-salon") } })).price).toBe(70000);
  });
});
