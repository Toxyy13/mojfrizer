import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, systemDb } from "./db";
import { applyComboPricing } from "./comboPricing";
import { TIME_ZONE, isValidDateIso, localToUtc, todayIso } from "./time";
import { MAX_SERVICES_PER_VISIT, resolveVisit, visitItemPrices } from "./visit";

export const urgentRequestSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1, "Izaberite uslugu").max(MAX_SERVICES_PER_VISIT),
  dateIso: z.string().refine(isValidDateIso, "Neispravan datum"),
  clientName: z.string().trim().min(2, "Unesite ime i prezime").max(80),
  clientPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 /-]{6,20}$/, "Unesite ispravan broj telefona"),
  reason: z.string().trim().min(5, "Napišite ukratko zašto je hitno").max(300),
});

export type UrgentRequestInput = z.infer<typeof urgentRequestSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createUrgentRequest(
  salonId: string,
  input: UrgentRequestInput,
  clientId: string | null,
): Promise<ActionResult> {
  if (input.dateIso < todayIso(TIME_ZONE)) return { ok: false, error: "Izabrani dan je prošao." };
  const visit = await resolveVisit(salonId, input.serviceIds);
  if (!visit) return { ok: false, error: "Usluga nije pronađena." };
  // Guests can file a request but not read it back: system access (RLS), after the caller's checks.
  const salon = await systemDb.salon.findUnique({ where: { id: salonId }, select: { urgentSurcharge: true } });
  await systemDb.urgentRequest.create({
    data: {
      salonId,
      serviceId: visit.services[0].id,
      serviceIds: visit.services.map((s) => s.id),
      clientId,
      guestName: input.clientName,
      guestPhone: input.clientPhone,
      date: new Date(`${input.dateIso}T00:00:00Z`),
      reason: input.reason,
      // The price the customer was shown on the form.
      surcharge: salon?.urgentSurcharge ?? 0,
    },
  });
  return { ok: true };
}

export const swapSchema = z.object({
  requestId: z.string().min(1),
  // Booked appointment whose slot the urgent customer takes.
  appointmentId: z.string().min(1),
  // New time for the customer who gives up their slot.
  newDateIso: z.string().refine(isValidDateIso, "Neispravan datum"),
  newTime: z.string().regex(/^\d{2}:\d{2}$/, "Unesite vreme kao 14:30"),
});

/**
 * Swap: the urgent customer gets the booked customer's slot (same hairdresser),
 * and the booked customer moves to the new time the owner agreed with them.
 * Overlaps are rejected by the appointments_no_overlap constraint.
 */
export async function swapForUrgentRequest(
  salonId: string,
  ownerId: string,
  input: z.infer<typeof swapSchema>,
): Promise<ActionResult> {
  const [hours, minutes] = input.newTime.split(":").map(Number);
  if (hours > 23 || minutes > 59) return { ok: false, error: "Unesite vreme kao 14:30" };
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.urgentRequest.findFirst({
        where: { id: input.requestId, salonId, status: "PENDING" },
        include: { service: true },
      });
      if (!request) return { ok: false, error: "Zahtev nije pronađen ili je već rešen." };
      const booked = await tx.appointment.findFirst({
        where: { id: input.appointmentId, salonId, status: "BOOKED" },
      });
      if (!booked) return { ok: false, error: "Izabrani termin nije pronađen." };

      const movedStart = localToUtc(input.newDateIso, hours * 60 + minutes, TIME_ZONE);
      if (movedStart.getTime() === booked.startTime.getTime()) {
        return { ok: false, error: "Novo vreme mora biti drugačije od starog." };
      }
      // The moved customer keeps their booking's length; the urgent visit gets its own.
      const movedEnd = new Date(movedStart.getTime() + (booked.endTime.getTime() - booked.startTime.getTime()));
      const requested = request.serviceIds.length > 0 ? request.serviceIds : [request.serviceId];
      const visit = (await resolveVisit(salonId, requested, tx)) ?? {
        services: [request.service],
        durationMinutes: request.service.durationMinutes,
      };
      const itemPrices = visitItemPrices(visit.services);
      const urgentStart = booked.startTime;
      const urgentEnd = new Date(urgentStart.getTime() + visit.durationMinutes * 60_000);

      // Move the booked customer first, so their old slot is free for the urgent one.
      await tx.appointment.update({ where: { id: booked.id }, data: { startTime: movedStart, endTime: movedEnd } });
      const created = await tx.appointment.create({
        data: {
          salonId,
          workerId: booked.workerId,
          serviceId: visit.services[0].id,
          services: {
            create: visit.services.map((s, i) => ({ serviceId: s.id, price: itemPrices[i], sortOrder: i })),
          },
          clientId: request.clientId,
          guestName: request.guestName,
          guestPhone: request.guestPhone,
          source: "SALON",
          createdById: ownerId,
          startTime: urgentStart,
          endTime: urgentEnd,
          price: itemPrices.reduce((sum, p) => sum + p, 0) + request.surcharge,
          urgentSurcharge: request.surcharge,
          note: `Hitno: ${request.reason}`,
        },
      });
      await tx.urgentRequest.update({
        where: { id: request.id },
        data: { status: "RESOLVED", appointmentId: created.id },
      });
      await applyComboPricing(tx, created.id);
      await applyComboPricing(tx, booked.id);
      return { ok: true } as const;
    });
  } catch (error) {
    if (isOverlapError(error)) {
      return {
        ok: false,
        error: "Preklapanje: novo vreme ili hitna usluga se poklapa sa drugim terminom tog frizera.",
      };
    }
    throw error;
  }
}

export async function setUrgentRequestStatus(
  salonId: string,
  requestId: string,
  status: "RESOLVED" | "DECLINED" | "PENDING",
): Promise<void> {
  await db.urgentRequest.updateMany({ where: { id: requestId, salonId }, data: { status } });
}

function isOverlapError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return (
      error.message.includes("appointments_no_overlap") ||
      error.message.includes("23P01") ||
      error.message.includes("appointments_time_order")
    );
  }
  return false;
}
