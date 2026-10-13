// Row Level Security against a real PostgreSQL (the one in DATABASE_URL, migrated like in CI).
// Every query goes through the same wrapper the app uses with RLS_ENFORCE=1, so these tests prove what the
// database lets each kind of visitor see and change, whatever the application code asks for.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.RLS_ENFORCE = "1";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

const { db, ownerDb, systemDb } = await import("../db");
const { runAsSystem, runAsUser } = await import("../rls");

const run = Math.random().toString(36).slice(2, 8);
const id = (name: string): string => `rls_${run}_${name}`;

const ids = {
  devUser: id("dev"),
  ownerA: id("ownerA"),
  ownerB: id("ownerB"),
  workerA: id("workerA"),
  clientA: id("clientA"),
  clientB: id("clientB"),
  stranger: id("stranger"),
  salonA: id("salonA"),
  salonB: id("salonB"),
  salonPrivate: id("salonP"),
  profileA: id("profileA"),
  profileB: id("profileB"),
  serviceA: id("serviceA"),
  serviceB: id("serviceB"),
  apptA: id("apptA"),
  apptB: id("apptB"),
};
const START = new Date("2031-05-05T08:00:00Z");
const END = new Date("2031-05-05T08:30:00Z");

const user = (userId: string, name: string, role: "ADMIN" | "WORKER" | "CLIENT" | "DEVELOPER") => ({
  id: userId,
  email: `${userId}@test.rs`,
  name,
  role,
  passwordHash: "x",
});

async function cleanup(): Promise<void> {
  const salons = [ids.salonA, ids.salonB, ids.salonPrivate];
  await ownerDb.chatMessage.deleteMany({ where: { salonId: { in: salons } } });
  await ownerDb.appointment.deleteMany({ where: { salonId: { in: salons } } });
  await ownerDb.salon.deleteMany({ where: { id: { in: salons } } });
  await ownerDb.user.deleteMany({ where: { id: { startsWith: `rls_${run}_` } } });
}

beforeAll(async () => {
  await cleanup();
  await ownerDb.user.createMany({
    data: [
      user(ids.devUser, "Dev", "DEVELOPER"),
      user(ids.ownerA, "Vlasnik A", "ADMIN"),
      user(ids.ownerB, "Vlasnik B", "ADMIN"),
      user(ids.workerA, "Frizer A", "WORKER"),
      user(ids.clientA, "Klijent A", "CLIENT"),
      user(ids.clientB, "Klijent B", "CLIENT"),
      user(ids.stranger, "Stranac", "CLIENT"),
    ],
  });
  const salon = (salonId: string, ownerId: string, visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") => ({
    id: salonId,
    name: salonId,
    slug: salonId,
    city: "Niš",
    address: "Ulica 1",
    ownerId,
    visibility,
  });
  await ownerDb.salon.createMany({
    data: [salon(ids.salonA, ids.ownerA), salon(ids.salonB, ids.ownerB), salon(ids.salonPrivate, ids.ownerB, "PRIVATE")],
  });
  await ownerDb.workerProfile.createMany({
    data: [
      { id: ids.profileA, salonId: ids.salonA, userId: ids.workerA, displayName: "Frizer A" },
      { id: ids.profileB, salonId: ids.salonB, userId: ids.ownerB, displayName: "Vlasnik B" },
    ],
  });
  await ownerDb.service.createMany({
    data: [
      { id: ids.serviceA, salonId: ids.salonA, name: "Šišanje A", price: 60000, durationMinutes: 30 },
      { id: ids.serviceB, salonId: ids.salonB, name: "Šišanje B", price: 60000, durationMinutes: 30 },
    ],
  });
  const appt = (apptId: string, salonId: string, workerId: string, serviceId: string, clientId: string, startOffsetDays: number) => ({
    id: apptId,
    salonId,
    workerId,
    serviceId,
    clientId,
    source: "ONLINE" as const,
    startTime: new Date(START.getTime() + startOffsetDays * 86_400_000),
    endTime: new Date(END.getTime() + startOffsetDays * 86_400_000),
    price: 60000,
  });
  await ownerDb.appointment.createMany({
    data: [
      appt(ids.apptA, ids.salonA, ids.profileA, ids.serviceA, ids.clientA, 0),
      appt(ids.apptB, ids.salonB, ids.profileB, ids.serviceB, ids.clientB, 0),
    ],
  });
  await ownerDb.chatMessage.createMany({
    data: [
      { salonId: ids.salonA, clientId: ids.clientA, senderId: ids.clientA, fromSalon: false, text: "poruka A" },
      { salonId: ids.salonB, clientId: ids.clientB, senderId: ids.clientB, fromSalon: false, text: "poruka B" },
    ],
  });
  await ownerDb.salonClientNote.createMany({
    data: [
      { salonId: ids.salonA, clientKey: `u:${ids.clientA}`, note: "beleška A" },
      { salonId: ids.salonB, clientKey: `u:${ids.clientB}`, note: "beleška B" },
    ],
  });
  await ownerDb.emailToken.create({ data: { userId: ids.clientA, kind: "RESET_PASSWORD", tokenHash: id("token"), expiresAt: new Date(Date.now() + 3_600_000) } });
});

afterAll(async () => {
  await cleanup();
  await ownerDb.$disconnect();
});

const mine = { id: { startsWith: `rls_${run}_` } };
const as = <T>(uid: string, fn: () => Promise<T>): Promise<T> => runAsUser(uid, fn);

describe("every table is protected", () => {
  it("has RLS enabled on all tables except Prisma's own", async () => {
    const rows = await ownerDb.$queryRaw<Array<{ relname: string }>>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and c.relname <> '_prisma_migrations'`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("lets the developer see everything, but only while the database still says so", async () => {
    // Without a scope the identity comes from the login cookie; stand in for it with the developer claim.
    const total = await runAsSystem(() => db.appointment.count({ where: { salonId: { in: [ids.salonA, ids.salonB] } } }));
    expect(total).toBe(2);
    const claim = await ownerDb.$transaction([
      ownerDb.$executeRaw`select set_config('role', 'mojfrizer_app', true), set_config('app.uid', ${ids.devUser}, true), set_config('app.devclaim', 'on', true)`,
      ownerDb.$queryRaw<Array<{ ok: boolean }>>`select app_sys() as ok`,
    ]);
    expect(claim[1][0].ok).toBe(true);
    const demoted = await ownerDb.$transaction([
      ownerDb.$executeRaw`select set_config('role', 'mojfrizer_app', true), set_config('app.uid', ${ids.clientA}, true), set_config('app.devclaim', 'on', true)`,
      ownerDb.$queryRaw<Array<{ ok: boolean }>>`select app_sys() as ok`,
    ]);
    expect(demoted[1][0].ok).toBe(false);
  });

  it("runs queries as a role that cannot bypass RLS and cannot touch Prisma's bookkeeping", async () => {
    const [row] = await as(ids.clientA, () => db.$queryRaw<Array<{ who: string; bypass: boolean }>>`
      select current_user as who, (select rolbypassrls from pg_roles where rolname = current_user) as bypass`);
    expect(row).toEqual({ who: "mojfrizer_app", bypass: false });
    await expect(as(ids.clientA, () => db.$queryRaw`select * from _prisma_migrations`)).rejects.toThrow();
  });
});

describe("one salon cannot see another", () => {
  it("owner A sees only salon A's bookings, services, chat and notes", async () => {
    await as(ids.ownerA, async () => {
      expect((await db.appointment.findMany({ where: { OR: [{ salonId: ids.salonA }, { salonId: ids.salonB }] } })).map((a) => a.id)).toEqual([ids.apptA]);
      expect((await db.appointment.findUnique({ where: { id: ids.apptB } }))).toBeNull();
      expect(await db.chatMessage.count({ where: { salonId: ids.salonB } })).toBe(0);
      expect(await db.chatMessage.count({ where: { salonId: ids.salonA } })).toBe(1);
      expect(await db.salonClientNote.count({ where: { salonId: ids.salonB } })).toBe(0);
      expect(await db.salonClientNote.count({ where: { salonId: ids.salonA } })).toBe(1);
    });
  });

  it("a query that forgets the salon filter still returns only own rows", async () => {
    await as(ids.ownerB, async () => {
      const appointments = await db.appointment.findMany({ where: { id: { in: [ids.apptA, ids.apptB] } } });
      expect(appointments.map((a) => a.id)).toEqual([ids.apptB]);
      const notes = await db.salonClientNote.findMany({ where: { salonId: { in: [ids.salonA, ids.salonB] } } });
      expect(notes.map((n) => n.salonId)).toEqual([ids.salonB]);
    });
  });

  it("owner A cannot change or delete salon B's rows", async () => {
    await as(ids.ownerA, async () => {
      expect((await db.appointment.updateMany({ where: { id: ids.apptB }, data: { status: "CANCELLED" } })).count).toBe(0);
      expect((await db.service.updateMany({ where: { id: ids.serviceB }, data: { price: 1 } })).count).toBe(0);
      expect((await db.salon.updateMany({ where: { id: ids.salonB }, data: { name: "hack" } })).count).toBe(0);
      expect((await db.salon.deleteMany({ where: { id: ids.salonB } })).count).toBe(0);
      expect((await db.chatMessage.deleteMany({ where: { salonId: ids.salonB } })).count).toBe(0);
    });
    const b = await ownerDb.appointment.findUniqueOrThrow({ where: { id: ids.apptB } });
    expect(b.status).toBe("BOOKED");
  });

  it("owner A cannot insert rows into salon B", async () => {
    await as(ids.ownerA, async () => {
      await expect(
        db.service.create({ data: { salonId: ids.salonB, name: "Podmetnuto", price: 1, durationMinutes: 5 } }),
      ).rejects.toThrow();
      await expect(
        db.appointment.create({
          data: { salonId: ids.salonB, workerId: ids.profileB, serviceId: ids.serviceB, source: "SALON", startTime: new Date("2031-06-01T08:00:00Z"), endTime: new Date("2031-06-01T08:30:00Z"), price: 1 },
        }),
      ).rejects.toThrow();
      await expect(db.chatMessage.create({ data: { salonId: ids.salonB, clientId: ids.clientB, senderId: ids.ownerA, fromSalon: true, text: "x" } })).rejects.toThrow();
    });
  });

  it("raw SQL and transactions are filtered the same way", async () => {
    await as(ids.ownerA, async () => {
      const [raw] = await db.$queryRaw<Array<{ n: bigint }>>`select count(*) as n from appointments where id in (${ids.apptA}, ${ids.apptB})`;
      expect(Number(raw.n)).toBe(1);
      const [a, b] = await db.$transaction([db.appointment.count({ where: { id: ids.apptA } }), db.appointment.count({ where: { id: ids.apptB } })]);
      expect([a, b]).toEqual([1, 0]);
      const inner = await db.$transaction(async (tx) => [await tx.appointment.count({ where: { id: ids.apptA } }), await tx.appointment.count({ where: { id: ids.apptB } })]);
      expect(inner).toEqual([1, 0]);
    });
  });

  it("staff logins see their salon's schedule but not its chat or notes", async () => {
    await as(ids.workerA, async () => {
      expect(await db.appointment.count({ where: { id: ids.apptA } })).toBe(1);
      expect(await db.appointment.count({ where: { id: ids.apptB } })).toBe(0);
      expect(await db.chatMessage.count({ where: { salonId: ids.salonA } })).toBe(0);
      expect(await db.salonClientNote.count({ where: { salonId: ids.salonA } })).toBe(0);
      expect((await db.service.updateMany({ where: { id: ids.serviceA }, data: { price: 1 } })).count).toBe(0);
    });
  });
});

describe("customers and visitors", () => {
  it("a customer sees only their own bookings, messages and profile", async () => {
    await as(ids.clientA, async () => {
      expect((await db.appointment.findMany({ where: { salonId: { in: [ids.salonA, ids.salonB] } } })).map((a) => a.id)).toEqual([ids.apptA]);
      expect(await db.chatMessage.count({ where: { salonId: { in: [ids.salonA, ids.salonB] } } })).toBe(1);
      expect((await db.user.findMany({ where: mine })).map((u) => u.id)).toEqual([ids.clientA]);
      expect(await db.emailToken.count()).toBe(0);
      expect((await db.appointment.updateMany({ where: { id: ids.apptB }, data: { status: "CANCELLED" } })).count).toBe(0);
    });
  });

  it("salon staff see the customers connected to their salon, no others", async () => {
    await as(ids.ownerA, async () => {
      expect((await db.user.findMany({ where: mine, orderBy: { id: "asc" } })).map((u) => u.id).sort()).toEqual([ids.clientA, ids.ownerA, ids.workerA].sort());
    });
  });

  it("a logged-out visitor sees public salons and nothing personal", async () => {
    const salons = (await db.salon.findMany({ where: { id: { in: [ids.salonA, ids.salonB, ids.salonPrivate] } } })).map((s) => s.id).sort();
    expect(salons).toEqual([ids.salonA, ids.salonB].sort());
    expect(await db.service.count({ where: { salonId: { in: [ids.salonA, ids.salonPrivate] } } })).toBe(1);
    expect(await db.appointment.count({ where: { salonId: ids.salonA } })).toBe(0);
    expect(await db.user.count({ where: mine })).toBe(0);
    expect(await db.chatMessage.count()).toBe(0);
    await expect(db.user.create({ data: { email: `${id("x")}@test.rs`, name: "x" } })).rejects.toThrow();
  });

  it("a private salon opens only for staff, the developer and customers who scanned its QR code", async () => {
    const visible = async (uid: string | null): Promise<boolean> => {
      const query = () => db.salon.count({ where: { id: ids.salonPrivate } }).then((n) => n === 1);
      return uid ? as(uid, query) : query();
    };
    expect(await visible(null)).toBe(false);
    expect(await visible(ids.stranger)).toBe(false);
    expect(await visible(ids.clientA)).toBe(false);
    expect(await visible(ids.ownerB)).toBe(true);
    expect(await visible(ids.devUser)).toBe(true);
    await runAsSystem(() => db.salonMembership.create({ data: { userId: ids.stranger, salonId: ids.salonPrivate } }));
    expect(await visible(ids.stranger)).toBe(true);
    // A customer cannot enrol themselves.
    await expect(as(ids.clientA, () => db.salonMembership.create({ data: { userId: ids.clientA, salonId: ids.salonPrivate } }))).rejects.toThrow();
  });
});

describe("explicit system access", () => {
  it("runAsSystem and systemDb see across salons", async () => {
    const all = await runAsSystem(() => db.appointment.count({ where: { id: { in: [ids.apptA, ids.apptB] } } }));
    expect(all).toBe(2);
    expect(await systemDb.appointment.count({ where: { id: { in: [ids.apptA, ids.apptB] } } })).toBe(2);
  });

  it("the system scope does not leak to the next call", async () => {
    await runAsSystem(() => db.appointment.count());
    expect(await db.appointment.count({ where: { id: { in: [ids.apptA, ids.apptB] } } })).toBe(0);
  });

  it("system code can create the rows visitors cannot", async () => {
    const created = await runAsSystem(() => db.user.create({ data: { email: `${id("new")}@test.rs`, name: "Novi", id: id("new") } }));
    expect(created.id).toBe(id("new"));
  });
});
