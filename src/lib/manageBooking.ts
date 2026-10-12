import { Prisma } from "@prisma/client";
import { db } from "./db";
import { getAvailableSlots } from "./booking";
import { applyComboPricing } from "./comboPricing";
import { sendMail } from "./mail";
import { notifyWaitlist } from "./waitlist";
import { fullAddress } from "./salonAddress";
import { TIME_ZONE, formatLocalDateIso, localToUtc } from "./time";

// Customers manage a booking through a secret link (/termin/{token}), with or without an account.

export const appointmentWhenFormat = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function appUrl(): string {
  return process.env.APP_URL ?? "https://mojfrizer.com";
}

export function manageUrl(token: string): string {
  return `${appUrl()}/termin/${token}`;
}

export async function loadManagedAppointment(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return db.appointment.findUnique({
    where: { manageToken: token },
    include: {
      salon: {
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          phone: true,
          cancelCutoffHours: true,
          owner: { select: { email: true } },
        },
      },
      service: true,
      worker: { select: { id: true, displayName: true } },
      client: { select: { name: true, email: true } },
      review: { select: { rating: true, comment: true } },
    },
  });
}

export type ManagedAppointment = NonNullable<Awaited<ReturnType<typeof loadManagedAppointment>>>;

/** Online changes are allowed while the booking is active and far enough ahead. */
export function canChangeOnline(a: Pick<ManagedAppointment, "status" | "startTime" | "salon">, now = new Date()): boolean {
  return a.status === "BOOKED" && a.startTime.getTime() - now.getTime() >= a.salon.cancelCutoffHours * 3_600_000;
}

export type ManageResult = { ok: true } | { ok: false; error: string };

function customerName(a: ManagedAppointment): string {
  return a.guestName ?? a.client?.name ?? "Mušterija";
}

/** Tells the salon owner about a change the customer made, so nobody waits for a no-show. */
async function notifySalon(a: ManagedAppointment, subject: string, lines: string[]): Promise<void> {
  const to = a.salon.owner.email;
  if (!to) return;
  try {
    await sendMail({
      to,
      subject,
      text: [...lines, "", `Raspored: ${appUrl()}/admin/${a.salon.slug}`, "", "mojfrizer.com"].join("\n"),
    });
  } catch (error) {
    // The change itself succeeded; a lost notification must not undo it.
    console.error(error);
  }
}

/** Re-prices the rest of a visit after one service left that day. */
async function repriceDay(salonId: string, dayIso: string, excludeId: string): Promise<void> {
  const other = await db.appointment.findFirst({
    where: {
      salonId,
      id: { not: excludeId },
      startTime: { gte: localToUtc(dayIso, 0, TIME_ZONE), lt: localToUtc(dayIso, 24 * 60, TIME_ZONE) },
    },
    select: { id: true },
  });
  if (other) await db.$transaction((tx) => applyComboPricing(tx, other.id));
}

export async function cancelByCustomer(token: string): Promise<ManageResult> {
  const a = await loadManagedAppointment(token);
  if (!a) return { ok: false, error: "Termin nije pronađen." };
  if (!canChangeOnline(a)) {
    return { ok: false, error: "Termin više ne može da se otkaže preko sajta. Pozovite salon." };
  }
  await db.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
    await applyComboPricing(tx, a.id);
  });
  await notifyWaitlist(a.salonId, formatLocalDateIso(a.startTime, TIME_ZONE));
  await notifySalon(a, `Otkazan termin: ${customerName(a)}`, [
    `${customerName(a)} je otkazao/la termin:`,
    `${appointmentWhenFormat.format(a.startTime)}, ${a.service.name} (${a.worker.displayName})`,
  ]);
  return { ok: true };
}

/** Moves a booking to a new free time, keeping the same service and, when free, the same hairdresser. */
export async function rescheduleByCustomer(token: string, dateIso: string, minute: number): Promise<ManageResult> {
  const a = await loadManagedAppointment(token);
  if (!a) return { ok: false, error: "Termin nije pronađen." };
  if (!canChangeOnline(a)) {
    return { ok: false, error: "Termin više ne može da se pomeri preko sajta. Pozovite salon." };
  }
  const slots = await getAvailableSlots({
    salonId: a.salonId,
    serviceId: a.serviceId,
    dateIso,
    workerId: null,
    enforceLeadTime: true,
  });
  const slot = slots.find((s) => s.minute === minute);
  if (!slot) return { ok: false, error: "Taj termin više nije slobodan. Izaberite drugi." };

  const startTime = localToUtc(dateIso, minute, TIME_ZONE);
  const endTime = new Date(startTime.getTime() + a.service.durationMinutes * 60_000);
  const oldDayIso = formatLocalDateIso(a.startTime, TIME_ZONE);
  const workerIds = slot.workerIds.includes(a.workerId)
    ? [a.workerId, ...slot.workerIds.filter((w) => w !== a.workerId)]
    : slot.workerIds;

  for (const workerId of workerIds) {
    try {
      const moved = await db.$transaction(
        async (tx) => {
          const overlap = await tx.appointment.count({
            where: {
              salonId: a.salonId,
              workerId,
              id: { not: a.id },
              status: { in: ["BOOKED", "COMPLETED"] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });
          if (overlap > 0) return false;
          await tx.appointment.update({
            where: { id: a.id },
            // A fresh reminder goes out for the new time.
            data: { workerId, startTime, endTime, reminderSentAt: null },
          });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (!moved) continue;
      await db.$transaction((tx) => applyComboPricing(tx, a.id));
      if (oldDayIso !== dateIso) await repriceDay(a.salonId, oldDayIso, a.id);
      await notifyWaitlist(a.salonId, oldDayIso);
      await notifySalon(a, `Pomeren termin: ${customerName(a)}`, [
        `${customerName(a)} je pomerio/la termin (${a.service.name}):`,
        `sa: ${appointmentWhenFormat.format(a.startTime)}`,
        `na: ${appointmentWhenFormat.format(startTime)}`,
      ]);
      return { ok: true };
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }
  return { ok: false, error: "Taj termin je upravo zauzet. Izaberite drugi." };
}

function isConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
    message.includes("appointments_no_overlap") ||
    message.includes("23P01")
  );
}

/**
 * Confirmation email right after an online booking, for customers whose account has an email.
 * Never throws: the booking is already saved, so a mail problem must not report it as failed.
 */
export async function sendBookingConfirmation(appointmentId: string): Promise<void> {
  try {
    const a = await db.appointment.findUnique({
      where: { id: appointmentId },
      select: { manageToken: true },
    });
    if (!a) return;
    const full = await loadManagedAppointment(a.manageToken);
    if (!full?.client?.email) return;
    await sendMail({
      to: full.client.email,
      subject: `Zakazano: ${full.salon.name}, ${appointmentWhenFormat.format(full.startTime)}`,
      text: [
        `Zdravo ${full.client.name},`,
        "",
        `vaš termin u salonu ${full.salon.name} je zakazan:`,
        appointmentWhenFormat.format(full.startTime),
        `Usluga: ${full.service.name} (${full.worker.displayName})`,
        `Adresa: ${fullAddress(full.salon)}`,
        "",
        `Otkažite, pomerite ili dodajte u kalendar: ${manageUrl(full.manageToken)}`,
        "",
        "mojfrizer.com",
      ].join("\n"),
    });
  } catch (error) {
    console.error(error);
  }
}

/** iCalendar file so the customer can add the visit to their phone's calendar. */
export function toIcs(a: ManagedAppointment): string {
  const stamp = (d: Date): string => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (s: string): string => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mojfrizer.com//termin//SR",
    "BEGIN:VEVENT",
    `UID:${a.id}@mojfrizer.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(a.startTime)}`,
    `DTEND:${stamp(a.endTime)}`,
    `SUMMARY:${escape(`${a.service.name}, ${a.salon.name}`)}`,
    `LOCATION:${escape(fullAddress(a.salon))}`,
    `DESCRIPTION:${escape(`Frizer: ${a.worker.displayName}\nOtkaži ili pomeri: ${manageUrl(a.manageToken)}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(`Termin u salonu ${a.salon.name}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
