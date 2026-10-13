import { Prisma, type BookingSource } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { runAsSystem } from "./rls";
import { TIME_ZONE, isValidDateIso, isoWeekdayOf, localToUtc } from "./time";
import { breakIntervalsForDay } from "./breaks";
import { applyComboPricing } from "./comboPricing";
import { MAX_SERVICES_PER_VISIT, resolveVisit, visitItemPrices } from "./visit";

// Customers can't book online a slot that starts sooner than this.
const ONLINE_LEAD_MINUTES = 30;
const ACTIVE_STATUSES = ["BOOKED", "COMPLETED"] as const;

export interface Slot {
  minute: number; // minutes from local midnight
  workerIds: string[]; // workers free at this time
}

type SlotQuery = {
  salonId: string;
  dateIso: string;
  workerId?: string | null;
  enforceLeadTime: boolean;
} & (
  | { serviceIds: string[] } // a new visit: its length follows from the services and the salon's combos
  | { durationMinutes: number } // moving an existing appointment: keep its length
);

async function slotDuration(query: SlotQuery): Promise<number | null> {
  if ("durationMinutes" in query) return query.durationMinutes > 0 ? query.durationMinutes : null;
  const visit = await resolveVisit(query.salonId, query.serviceIds);
  return visit?.durationMinutes ?? null;
}

/** Free start times for a visit on a day: opening hours minus days off minus busy workers. */
export function getAvailableSlots(query: SlotQuery): Promise<Slot[]> {
  // Visitors have no right to read other people's bookings, but the calendar needs them: system access (RLS).
  return runAsSystem(() => computeAvailableSlots(query));
}

async function computeAvailableSlots(query: SlotQuery): Promise<Slot[]> {
  if (!isValidDateIso(query.dateIso)) return [];
  const [salon, durationMinutes, hours, dayOff] = await Promise.all([
    db.salon.findFirst({ where: { id: query.salonId, isActive: true } }),
    slotDuration(query),
    db.workingHours.findMany({
      where: { salonId: query.salonId, dayOfWeek: isoWeekdayOf(query.dateIso) },
      orderBy: { opensAt: "asc" },
    }),
    db.salonDayOff.findUnique({
      where: { salonId_date: { salonId: query.salonId, date: new Date(`${query.dateIso}T00:00:00Z`) } },
    }),
  ]);
  if (!salon || durationMinutes === null || hours.length === 0 || dayOff) return [];

  const workers = await db.workerProfile.findMany({
    where: { salonId: salon.id, isActive: true, ...(query.workerId ? { id: query.workerId } : {}) },
    select: { id: true },
  });
  if (workers.length === 0) return [];

  const dayStart = localToUtc(query.dateIso, 0, TIME_ZONE);
  const dayEnd = localToUtc(query.dateIso, 24 * 60, TIME_ZONE);
  const workerFilter = {
    salonId: salon.id,
    workerId: { in: workers.map((w) => w.id) },
    startTime: { lt: dayEnd },
    endTime: { gt: dayStart },
  };
  const select = { workerId: true, startTime: true, endTime: true } as const;
  // A worker is busy during their appointments and their time off (vacation, sick leave, blocked time).
  const [appointments, timeOff, breakRules] = await Promise.all([
    db.appointment.findMany({ where: { ...workerFilter, status: { in: [...ACTIVE_STATUSES] } }, select }),
    db.workerTimeOff.findMany({ where: workerFilter, select }),
    db.workerBreak.findMany({ where: { salonId: salon.id, workerId: { in: workers.map((w) => w.id) } } }),
  ]);
  // Breaks (lunch, coffee) block a worker like time off does, so a visit can't run across one.
  const busy = [...appointments, ...timeOff, ...breakIntervalsForDay(breakRules, query.dateIso)];

  const earliest = Date.now() + (query.enforceLeadTime ? ONLINE_LEAD_MINUTES * 60_000 : 0);
  const slots: Slot[] = [];
  // Several ranges per day are possible (e.g. a lunch break); a visit must fit inside one range.
  for (const range of hours) {
    for (let m = range.opensAt; m + durationMinutes <= range.closesAt; m += salon.slotStepMinutes) {
      const start = localToUtc(query.dateIso, m, TIME_ZONE);
      if (start.getTime() < earliest) continue;
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const free = workers
        .filter((w) => !busy.some((b) => b.workerId === w.id && b.startTime < end && b.endTime > start))
        .map((w) => w.id);
      if (free.length > 0) slots.push({ minute: m, workerIds: free });
    }
  }
  return slots;
}

const phoneRule = z.string().trim().regex(/^\+?[0-9 /-]{6,20}$/, "Unesite ispravan broj telefona");

const bookingBaseSchema = z.object({
  serviceIds: z
    .array(z.string().min(1))
    .min(1, "Izaberite bar jednu uslugu")
    .max(MAX_SERVICES_PER_VISIT, `Najviše ${MAX_SERVICES_PER_VISIT} usluga u jednom terminu`),
  workerId: z.string().optional().nullable(),
  dateIso: z.string().refine(isValidDateIso, "Neispravan datum"),
  minute: z.coerce.number().int().min(0).max(24 * 60),
  clientName: z.string().trim().min(2, "Unesite ime i prezime").max(80),
  note: z.string().trim().max(300).optional().nullable(),
});

/** Online booking by a customer or guest: the salon needs a way to reach them, so the phone is required. */
export const bookingInputSchema = bookingBaseSchema.extend({ clientPhone: phoneRule });

/** Booking entered by the owner or staff: only the name is required; a phone is validated when given. */
export const salonBookingInputSchema = bookingBaseSchema.extend({
  clientPhone: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), phoneRule.nullish()),
});

export type BookingInput = Omit<z.infer<typeof bookingInputSchema>, "clientPhone"> & { clientPhone?: string | null };

export type BookingResult =
  | { ok: true; appointmentId: string; workerName: string; manageToken: string }
  | { ok: false; error: string };

export interface BookingActor {
  source: BookingSource;
  createdById: string | null; // logged-in user who made the booking, if any
  clientId: string | null; // customer's account, if the customer is logged in
}

/**
 * Creates an appointment after re-checking availability inside a serializable transaction.
 * The DB exclusion constraint "appointments_no_overlap" is the final guard against races.
 */
export function createAppointment(salonId: string, input: BookingInput, actor: BookingActor): Promise<BookingResult> {
  // Guests book without an account and cannot read the row they create: system access (RLS), after the caller's checks.
  return runAsSystem(() => insertAppointment(salonId, input, actor));
}

async function insertAppointment(salonId: string, input: BookingInput, actor: BookingActor): Promise<BookingResult> {
  const visit = await resolveVisit(salonId, input.serviceIds);
  if (!visit) return { ok: false, error: "Usluga nije pronađena." };
  const itemPrices = visitItemPrices(visit.services);

  const slots = await getAvailableSlots({
    salonId,
    durationMinutes: visit.durationMinutes,
    dateIso: input.dateIso,
    workerId: input.workerId || null,
    enforceLeadTime: actor.source === "ONLINE",
  });
  const slot = slots.find((s) => s.minute === input.minute);
  if (!slot) return { ok: false, error: "Termin više nije slobodan. Izaberite drugi." };

  const startTime = localToUtc(input.dateIso, input.minute, TIME_ZONE);
  const endTime = new Date(startTime.getTime() + visit.durationMinutes * 60_000);

  for (const workerId of slot.workerIds) {
    try {
      const created = await withSerializationRetry(() => db.$transaction(
        async (tx) => {
          const overlap = await tx.appointment.count({
            where: {
              salonId,
              workerId,
              status: { in: [...ACTIVE_STATUSES] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });
          if (overlap > 0) return null;
          return tx.appointment.create({
            data: {
              salonId,
              workerId,
              serviceId: visit.services[0].id,
              services: {
                create: visit.services.map((s, i) => ({ serviceId: s.id, price: itemPrices[i], sortOrder: i })),
              },
              clientId: actor.clientId,
              guestName: input.clientName,
              guestPhone: input.clientPhone || null,
              source: actor.source,
              createdById: actor.createdById,
              note: input.note || null,
              price: itemPrices.reduce((sum, p) => sum + p, 0),
              startTime,
              endTime,
            },
            include: { worker: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ));
      if (created) {
        // Separate step so a pricing update never makes the slot look taken.
        await db.$transaction((tx) => applyComboPricing(tx, created.id));
        return {
          ok: true,
          appointmentId: created.id,
          workerName: created.worker.displayName,
          manageToken: created.manageToken,
        };
      }
    } catch (error) {
      if (!isConflictError(error)) throw error;
      // Someone grabbed this worker at the same moment; try the next free worker.
    }
  }
  return { ok: false, error: "Termin je upravo zauzet. Izaberite drugi." };
}

/**
 * Serializable transactions can be aborted (P2034) just because another one ran at the same moment, even for
 * another salon. Trying again re-checks the overlap, so a real double booking still ends as "taken".
 */
export async function withSerializationRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const serialization = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!serialization || attempt >= attempts) throw error;
    }
  }
}

function isConflictError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034" || error.message.includes("appointments_no_overlap");
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return error.message.includes("appointments_no_overlap") || error.message.includes("23P01");
  }
  return false;
}
