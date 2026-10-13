import { db } from "./db";
import { TIME_ZONE } from "./time";

// Usage and revenue statistics for the platform developer. Revenue counts COMPLETED appointments
// (the real pazar); "booked" adds appointments still to come, so growth is visible before visits are marked done.

export interface MonthPoint {
  monthIso: string; // YYYY-MM
  bookings: number; // all except cancelled
  revenuePara: number; // completed
  bookedPara: number; // booked + completed
}

export interface SalonStats {
  id: string;
  name: string;
  slug: string;
  city: string;
  isActive: boolean;
  createdAt: Date;
  activeStaff: number;
  clients: number;
  bookings30d: number;
  messages30d: number;
  assistant30d: number;
  thisMonth: MonthPoint;
  lastMonth: MonthPoint;
  /** Percent change of this month's value against last month; null when there is nothing to compare. */
  growthPercent: number | null;
}

export interface PlatformStats {
  monthIso: string;
  salons: SalonStats[];
  activeSalons: number;
  suspendedSalons: number;
  customerAccounts: number;
  bookings30d: number;
  messages30d: number;
  assistant30d: number;
  series: MonthPoint[];
}

export function growthPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function currentMonthIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).format(now).slice(0, 7);
}

export function shiftMonthIso(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** The last `count` months ending at `endMonthIso`, oldest first, with zeros where nothing happened. */
export function fillMonths(points: MonthPoint[], endMonthIso: string, count: number): MonthPoint[] {
  const byMonth = new Map(points.map((p) => [p.monthIso, p]));
  return Array.from({ length: count }, (_, i) => {
    const monthIso = shiftMonthIso(endMonthIso, i - (count - 1));
    return byMonth.get(monthIso) ?? { monthIso, bookings: 0, revenuePara: 0, bookedPara: 0 };
  });
}

interface MonthRow {
  salonId: string;
  month: string;
  bookings: bigint;
  revenue: bigint | null;
  booked: bigint | null;
}

async function monthlyRows(since: Date, salonId?: string): Promise<MonthRow[]> {
  return db.$queryRaw<MonthRow[]>`
    SELECT "salonId",
           to_char(date_trunc('month', "startTime" AT TIME ZONE ${TIME_ZONE}), 'YYYY-MM') AS month,
           count(*) FILTER (WHERE status IN ('BOOKED', 'COMPLETED', 'NO_SHOW')) AS bookings,
           sum(price) FILTER (WHERE status = 'COMPLETED') AS revenue,
           sum(price) FILTER (WHERE status IN ('BOOKED', 'COMPLETED')) AS booked
    FROM appointments
    WHERE "startTime" >= ${since} AND (${salonId ?? null}::text IS NULL OR "salonId" = ${salonId ?? null})
    GROUP BY 1, 2`;
}

const toPoint = (row: MonthRow): MonthPoint => ({
  monthIso: row.month,
  bookings: Number(row.bookings),
  revenuePara: Number(row.revenue ?? 0),
  bookedPara: Number(row.booked ?? 0),
});

const sinceMonths = (endMonthIso: string, count: number): Date => new Date(`${shiftMonthIso(endMonthIso, 1 - count)}-01T00:00:00Z`);

/** Month-by-month series for one salon (12 months by default). */
export async function getSalonSeries(salonId: string, months = 12, now: Date = new Date()): Promise<MonthPoint[]> {
  const end = currentMonthIso(now);
  // One day of slack: the UTC month start can fall slightly before the Belgrade month start.
  const since = new Date(sinceMonths(end, months).getTime() - 86_400_000);
  const rows = await monthlyRows(since, salonId);
  return fillMonths(rows.map(toPoint), end, months);
}

function sumSeries(points: MonthPoint[]): MonthPoint[] {
  const total = new Map<string, MonthPoint>();
  for (const p of points) {
    const t = total.get(p.monthIso) ?? { monthIso: p.monthIso, bookings: 0, revenuePara: 0, bookedPara: 0 };
    t.bookings += p.bookings;
    t.revenuePara += p.revenuePara;
    t.bookedPara += p.bookedPara;
    total.set(p.monthIso, t);
  }
  return [...total.values()];
}

/** Everything the developer overview shows, in a handful of queries (no per-salon loops). */
export async function getPlatformStats(now: Date = new Date()): Promise<PlatformStats> {
  const monthIso = currentMonthIso(now);
  const prevIso = shiftMonthIso(monthIso, -1);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const since = new Date(sinceMonths(monthIso, 12).getTime() - 86_400_000);

  const [salons, rows, staff, clients, bookings30, messages30, assistant30, customerAccounts] = await Promise.all([
    db.salon.findMany({ select: { id: true, name: true, slug: true, city: true, isActive: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    monthlyRows(since),
    db.workerProfile.groupBy({ by: ["salonId"], where: { isActive: true }, _count: { _all: true } }),
    db.$queryRaw<Array<{ salonId: string; clients: bigint }>>`
      SELECT "salonId", count(DISTINCT coalesce("clientId", "guestPhone", id)) AS clients
      FROM appointments WHERE status <> 'CANCELLED' GROUP BY "salonId"`,
    db.appointment.groupBy({ by: ["salonId"], where: { createdAt: { gte: since30 }, status: { not: "CANCELLED" } }, _count: { _all: true } }),
    db.chatMessage.groupBy({ by: ["salonId"], where: { createdAt: { gte: since30 } }, _count: { _all: true } }),
    db.assistantUse.groupBy({ by: ["salonId"], where: { createdAt: { gte: since30 } }, _count: { _all: true } }),
    db.user.count({ where: { role: "CLIENT" } }),
  ]);

  const counts = (list: Array<{ salonId: string | null; _count: { _all: number } }>): Map<string | null, number> =>
    new Map(list.map((r) => [r.salonId, r._count._all]));
  const staffBy = counts(staff);
  const bookingsBy = counts(bookings30);
  const messagesBy = counts(messages30);
  const assistantBy = counts(assistant30);
  const clientsBy = new Map(clients.map((r) => [r.salonId, Number(r.clients)]));

  const empty = (m: string): MonthPoint => ({ monthIso: m, bookings: 0, revenuePara: 0, bookedPara: 0 });
  const salonStats: SalonStats[] = salons.map((s) => {
    const own = rows.filter((r) => r.salonId === s.id).map(toPoint);
    const thisMonth = own.find((p) => p.monthIso === monthIso) ?? empty(monthIso);
    const lastMonth = own.find((p) => p.monthIso === prevIso) ?? empty(prevIso);
    return {
      ...s,
      activeStaff: staffBy.get(s.id) ?? 0,
      clients: clientsBy.get(s.id) ?? 0,
      bookings30d: bookingsBy.get(s.id) ?? 0,
      messages30d: messagesBy.get(s.id) ?? 0,
      assistant30d: assistantBy.get(s.id) ?? 0,
      thisMonth,
      lastMonth,
      growthPercent: growthPercent(thisMonth.bookedPara, lastMonth.bookedPara),
    };
  });

  const sum = (m: Map<string | null, number>): number => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    monthIso,
    salons: salonStats,
    activeSalons: salons.filter((s) => s.isActive).length,
    suspendedSalons: salons.filter((s) => !s.isActive).length,
    customerAccounts,
    bookings30d: sum(bookingsBy),
    messages30d: sum(messagesBy),
    assistant30d: sum(assistantBy),
    series: fillMonths(sumSeries(rows.map(toPoint)), monthIso, 12),
  };
}
