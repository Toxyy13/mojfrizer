import type { SalonDayOff, Service, WorkerProfile, WorkingHours } from "@prisma/client";
import type { BookingService, BookingWorker } from "@/components/BookingForm";
import { formatServicePrice } from "./money";
import { TIME_ZONE, addDaysIso, isoWeekdayOf, todayIso } from "./time";

const SHORT_DAYS = ["", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const DEFAULT_CATEGORY = "Ostalo";

export function serviceCategory(service: Pick<Service, "category">): string {
  return service.category ?? DEFAULT_CATEGORY;
}

export function toBookingServices(services: Service[]): BookingService[] {
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    category: serviceCategory(s),
    priceLabel: formatServicePrice(s),
    durationMin: s.durationMinutes,
    price: s.price,
    comboPrice: s.comboPrice,
  }));
}

export function toBookingWorkers(workers: WorkerProfile[]): BookingWorker[] {
  return workers.map((w) => ({ id: w.id, name: w.displayName }));
}

/** Day chips for the booking form; days with no hours or marked as day off are disabled. */
export function upcomingDays(
  hours: WorkingHours[],
  daysOff: SalonDayOff[],
  count: number,
  startIso?: string,
): Array<{ iso: string; label: string; closed: boolean }> {
  const start = startIso ?? todayIso(TIME_ZONE);
  const open = new Set(hours.map((h) => h.dayOfWeek));
  const off = new Set(daysOff.map((d) => d.date.toISOString().slice(0, 10)));
  return Array.from({ length: count }, (_, i) => {
    const iso = addDaysIso(start, i);
    const [, m, d] = iso.split("-").map(Number);
    const wd = isoWeekdayOf(iso);
    const label = i === 0 && !startIso ? `Danas ${d}.${m}.` : `${SHORT_DAYS[wd]} ${d}.${m}.`;
    return { iso, label, closed: !open.has(wd) || off.has(iso) };
  });
}
