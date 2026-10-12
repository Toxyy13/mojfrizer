import type { AppointmentStatus } from "@prisma/client";
import { db } from "./db";
import { clientKeyOf, listSalonClients } from "./clients";
import { TIME_ZONE, formatLocalDateIso, localToUtc } from "./time";

// Monthly report for the salon owner. Revenue counts only COMPLETED appointments, like the daily pazar.

export interface ReportRow {
  label: string;
  count: number;
  revenuePara: number;
}

export interface MonthReport {
  monthIso: string; // YYYY-MM
  revenuePara: number;
  byStatus: Record<AppointmentStatus, number>;
  onlineShare: number; // 0..1 of all non-cancelled bookings
  uniqueClients: number;
  newClients: number;
  byService: ReportRow[];
  byWorker: ReportRow[];
  byDay: Array<{ dateIso: string; revenuePara: number; count: number }>;
  previousRevenuePara: number;
}

export function isValidMonthIso(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthRange(monthIso: string): { from: Date; to: Date } {
  return {
    from: localToUtc(`${monthIso}-01`, 0, TIME_ZONE),
    to: localToUtc(`${shiftMonth(monthIso, 1)}-01`, 0, TIME_ZONE),
  };
}

function toRows(map: Map<string, ReportRow>): ReportRow[] {
  return [...map.values()].sort((a, b) => b.revenuePara - a.revenuePara || b.count - a.count);
}

export async function getMonthReport(salonId: string, monthIso: string): Promise<MonthReport> {
  const { from, to } = monthRange(monthIso);
  const prev = monthRange(shiftMonth(monthIso, -1));
  const [appointments, previous, clients] = await Promise.all([
    db.appointment.findMany({
      where: { salonId, startTime: { gte: from, lt: to } },
      select: {
        id: true,
        status: true,
        source: true,
        price: true,
        startTime: true,
        guestPhone: true,
        clientId: true,
        client: { select: { phone: true } },
        service: { select: { name: true } },
        worker: { select: { displayName: true } },
      },
    }),
    db.appointment.aggregate({
      where: { salonId, status: "COMPLETED", startTime: { gte: prev.from, lt: prev.to } },
      _sum: { price: true },
    }),
    listSalonClients(salonId),
  ]);

  const byStatus: Record<AppointmentStatus, number> = { BOOKED: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
  const services = new Map<string, ReportRow>();
  const workers = new Map<string, ReportRow>();
  const days = new Map<string, { dateIso: string; revenuePara: number; count: number }>();
  const keys = new Set<string>();
  let revenue = 0;
  let online = 0;

  for (const a of appointments) {
    byStatus[a.status] += 1;
    if (a.status === "CANCELLED") continue;
    if (a.source === "ONLINE") online += 1;
    keys.add(clientKeyOf(a));
    if (a.status !== "COMPLETED") continue;
    revenue += a.price;
    for (const [map, label] of [
      [services, a.service.name],
      [workers, a.worker.displayName],
    ] as const) {
      const row = map.get(label) ?? { label, count: 0, revenuePara: 0 };
      row.count += 1;
      row.revenuePara += a.price;
      map.set(label, row);
    }
    const dateIso = formatLocalDateIso(a.startTime, TIME_ZONE);
    const day = days.get(dateIso) ?? { dateIso, revenuePara: 0, count: 0 };
    day.count += 1;
    day.revenuePara += a.price;
    days.set(dateIso, day);
  }

  const active = appointments.length - byStatus.CANCELLED;
  return {
    monthIso,
    revenuePara: revenue,
    byStatus,
    onlineShare: active > 0 ? online / active : 0,
    uniqueClients: keys.size,
    newClients: clients.filter((c) => c.firstVisit >= from && c.firstVisit < to).length,
    byService: toRows(services),
    byWorker: toRows(workers),
    byDay: [...days.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    previousRevenuePara: previous._sum.price ?? 0,
  };
}
