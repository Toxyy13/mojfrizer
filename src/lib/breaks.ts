import type { WorkerBreak } from "@prisma/client";
import { TIME_ZONE, formatLocalDateIso, isoWeekdayOf, localToUtc } from "./time";

type BreakRule = Pick<WorkerBreak, "workerId" | "startMinute" | "endMinute" | "weekdays" | "date"> & { id?: string; label?: string | null };

export interface BreakInterval {
  id: string | null;
  label: string | null;
  workerId: string;
  startTime: Date;
  endTime: Date;
}

/** Concrete busy intervals the given break rules produce on one local day. */
export function breakIntervalsForDay(rules: BreakRule[], dateIso: string): BreakInterval[] {
  const weekday = isoWeekdayOf(dateIso);
  return rules
    .filter((r) => (r.date ? r.date.toISOString().slice(0, 10) === dateIso : r.weekdays.includes(weekday)))
    .map((r) => ({
      id: r.id ?? null,
      label: r.label ?? null,
      workerId: r.workerId,
      startTime: localToUtc(dateIso, r.startMinute, TIME_ZONE),
      endTime: localToUtc(dateIso, r.endMinute, TIME_ZONE),
    }));
}

/** Already booked visits that a (new) break would cut into. They are kept; the owner decides what to do. */
export function appointmentsInBreak<T extends { startTime: Date; endTime: Date }>(rule: BreakRule, appointments: T[]): T[] {
  return appointments.filter((a) => {
    const dateIso = formatLocalDateIso(a.startTime, TIME_ZONE);
    return breakIntervalsForDay([rule], dateIso).some((b) => b.startTime < a.endTime && b.endTime > a.startTime);
  });
}
