import { Prisma, type BookingSource } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { TIME_ZONE, isValidDateIso, isoWeekdayOf, localToUtc } from "./time";

// Customers can't book online a slot that starts sooner than this.
const ONLINE_LEAD_MINUTES = 30;
const ACTIVE_STATUSES = ["BOOKED", "COMPLETED"] as const;

export interface Slot {
  minute: number; // minutes from local midnight
  workerIds: string[]; // workers free at this time
}

interface SlotQuery {
  salonId: string;
  serviceId: string;
  dateIso: string;
  workerId?: string | null;
  enforceLeadTime: boolean;
}

/** Free start times for a service on a day: opening hours minus days off minus busy workers. */
export async function getAvailableSlots(query: SlotQuery): Promise<Slot[]> {
  if (!isValidDateIso(query.dateIso)) return [];
  const [salon, service, hours, dayOff] = await Promise.all([
    db.salon.findFirst({ where: { id: query.salonId, isActive: true } }),
    db.service.findFirst({ where: { id: query.serviceId, salonId: query.salonId, isActive: true } }),
    db.workingHours.findMany({
      where: { salonId: query.salonId, dayOfWeek: isoWeekdayOf(query.dateIso) },
      orderBy: { opensAt: "asc" },
    }),
    db.salonDayOff.findUnique({
      where: { salonId_date: { salonId: query.salonId, date: new Date(`${query.dateIso}T00:00:00Z`) } },
    }),
  ]);
  if (!salon || !service || hours.length === 0 || dayOff) return [];

  const workers = await db.workerProfile.findMany({
    where: { salonId: salon.id, isActive: true, ...(query.workerId ? { id: query.workerId } : {}) },
    select: { id: true },
  });
  if (workers.length === 0) return [];

  const dayStart = localToUtc(query.dateIso, 0, TIME_ZONE);
  const dayEnd = localToUtc(query.dateIso, 24 * 60, TIME_ZONE);
  const busy = await db.appointment.findMany({
    where: {
      salonId: salon.id,
      workerId: { in: workers.map((w) => w.id) },
      status: { in: [...ACTIVE_STATUSES] },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { workerId: true, startTime: true, endTime: true },
  });

  const earliest = Date.now() + (query.enforceLeadTime ? ONLINE_LEAD_MINUTES * 60_000 : 0);
  const slots: Slot[] = [];
  // Several ranges per day are possible (e.g. a lunch break); a service must fit inside one range.
  for (const range of hours) {
    for (let m = range.opensAt; m + service.durationMinutes <= range.closesAt; m += salon.slotStepMinutes) {
      const start = localToUtc(query.dateIso, m, TIME_ZONE);
      if (start.getTime() < earliest) continue;
      const end = new Date(start.getTime() + service.durationMinutes * 60_000);
      const free = workers
        .filter((w) => !busy.some((b) => b.workerId === w.id && b.startTime < end && b.endTime > start))
        .map((w) => w.id);
      if (free.length > 0) slots.push({ minute: m, workerIds: free });
    }
  }
  return slots;
}

export const bookingInputSchema = z.object({
  serviceId: z.string().min(1),
  workerId: z.string().optional().nullable(),
  dateIso: z.string().refine(isValidDateIso, "Neispravan datum"),
  minute: z.coerce.number().int().min(0).max(24 * 60),
  clientName: z.string().trim().min(2, "Unesite ime i prezime").max(80),
  clientPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 /-]{6,20}$/, "Unesite ispravan broj telefona"),
  note: z.string().trim().max(300).optional().nullable(),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export type BookingResult =
  | { ok: true; appointmentId: string; workerName: string }
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
export async function createAppointment(
  salonId: string,
  input: BookingInput,
  actor: BookingActor,
): Promise<BookingResult> {
  const service = await db.service.findFirst({ where: { id: input.serviceId, salonId, isActive: true } });
  if (!service) return { ok: false, error: "Usluga nije pronađena." };

  const slots = await getAvailableSlots({
    salonId,
    serviceId: service.id,
    dateIso: input.dateIso,
    workerId: input.workerId || null,
    enforceLeadTime: actor.source === "ONLINE",
  });
  const slot = slots.find((s) => s.minute === input.minute);
  if (!slot) return { ok: false, error: "Termin više nije slobodan. Izaberite drugi." };

  const startTime = localToUtc(input.dateIso, input.minute, TIME_ZONE);
  const endTime = new Date(startTime.getTime() + service.durationMinutes * 60_000);

  for (const workerId of slot.workerIds) {
    try {
      const created = await db.$transaction(
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
              serviceId: service.id,
              clientId: actor.clientId,
              guestName: input.clientName,
              guestPhone: input.clientPhone,
              source: actor.source,
              createdById: actor.createdById,
              note: input.note || null,
              price: service.price,
              startTime,
              endTime,
            },
            include: { worker: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (created) return { ok: true, appointmentId: created.id, workerName: created.worker.displayName };
    } catch (error) {
      if (!isConflictError(error)) throw error;
      // Someone grabbed this worker at the same moment; try the next free worker.
    }
  }
  return { ok: false, error: "Termin je upravo zauzet. Izaberite drugi." };
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
