import type { Prisma } from "@prisma/client";
import { TIME_ZONE, formatLocalDateIso, localToUtc } from "./time";

const ACTIVE_STATUSES = ["BOOKED", "COMPLETED"] as const;

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Compare the last 8 digits so "064 123 4567" and "+381 64 1234567" match.
  return digits.length >= 6 ? digits.slice(-8) : null;
}

/**
 * Recomputes prices of one customer's appointments on one day in a salon.
 * A service with comboPrice is charged comboPrice when the same visit (same customer,
 * same day) also has another active service, and its normal price otherwise.
 * Called after any booking or status change that can add or remove a service from a visit.
 */
export async function applyComboPricing(tx: Prisma.TransactionClient, appointmentId: string): Promise<void> {
  const anchor = await tx.appointment.findUnique({ where: { id: appointmentId } });
  if (!anchor) return;
  const dayIso = formatLocalDateIso(anchor.startTime, TIME_ZONE);
  const sameDay = await tx.appointment.findMany({
    where: {
      salonId: anchor.salonId,
      startTime: { gte: localToUtc(dayIso, 0, TIME_ZONE), lt: localToUtc(dayIso, 24 * 60, TIME_ZONE) },
    },
    include: { service: { select: { price: true, comboPrice: true } } },
  });

  const anchorPhone = normalizePhone(anchor.guestPhone);
  const visit = sameDay.filter(
    (a) =>
      (anchor.clientId !== null && a.clientId === anchor.clientId) ||
      (anchorPhone !== null && normalizePhone(a.guestPhone) === anchorPhone),
  );
  const active = visit.filter((a) => (ACTIVE_STATUSES as readonly string[]).includes(a.status));

  for (const appt of visit) {
    if (appt.service.comboPrice === null || appt.status === "COMPLETED") continue;
    const hasOtherService = active.some((a) => a.id !== appt.id && a.serviceId !== appt.serviceId);
    const price = hasOtherService ? appt.service.comboPrice : appt.service.price;
    if (price !== appt.price) await tx.appointment.update({ where: { id: appt.id }, data: { price } });
  }
}
