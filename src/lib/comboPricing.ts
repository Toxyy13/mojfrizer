import type { Prisma } from "@prisma/client";
import { comboRulePrices } from "./comboRule";
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
 * same day) also has another active service, either in the same appointment or in
 * another one, and its normal price otherwise. Appointment.price is the sum of its services.
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
    include: {
      services: { include: { service: { select: { price: true, comboPrice: true } } } },
    },
  });

  const anchorPhone = normalizePhone(anchor.guestPhone);
  const visit = sameDay.filter(
    (a) =>
      a.id === anchor.id || // a customer entered by name only still gets combo pricing within the one appointment
      (anchor.clientId !== null && a.clientId === anchor.clientId) ||
      (anchorPhone !== null && normalizePhone(a.guestPhone) === anchorPhone),
  );
  const isActive = (status: string): boolean => (ACTIVE_STATUSES as readonly string[]).includes(status);
  // Every service the customer has that day, in active appointments.
  const activeItems = visit
    .filter((a) => isActive(a.status))
    .flatMap((a) => a.services.map((item) => ({ itemId: item.id, ...item.service })))
    .sort((x, y) => y.price - x.price || x.itemId.localeCompare(y.itemId));

  for (const appt of visit) {
    if (appt.status === "COMPLETED") continue; // past revenue stays as charged
    let total = 0;
    for (const item of appt.services) {
      // Items of a cancelled appointment are priced as if added to the customer's active visit.
      const inVisit = activeItems.some((o) => o.itemId === item.id);
      const items = inVisit ? activeItems : [...activeItems, { itemId: item.id, ...item.service }];
      const price = comboRulePrices(items)[items.findIndex((o) => o.itemId === item.id)];
      if (price !== item.price) await tx.appointmentService.update({ where: { id: item.id }, data: { price } });
      total += price;
    }
    // An urgent surcharge is part of the appointment's price but not of any service's.
    total += appt.urgentSurcharge;
    if (appt.services.length > 0 && total !== appt.price) {
      await tx.appointment.update({ where: { id: appt.id }, data: { price: total } });
    }
  }
}
