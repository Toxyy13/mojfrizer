// Small timezone helpers: the DB stores UTC, salons see Belgrade local time.

export const TIME_ZONE = "Europe/Belgrade";

// Indexed by ISO day of week: 1 = Monday ... 7 = Sunday (index 0 unused).
export const WEEKDAYS_SR: readonly string[] = [
  "",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedelja",
];

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // ISO: 1 = Monday ... 7 = Sunday
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

/** Converts a local wall-clock time (YYYY-MM-DD + minutes from midnight) in timeZone to a UTC Date. */
export function localToUtc(dateIso: string, minuteOfDay: number, timeZone: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Second pass handles DST boundaries.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** ISO day of week for a YYYY-MM-DD date: 1 = Monday ... 7 = Sunday. */
export function isoWeekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

export function todayIso(timeZone: string): string {
  return formatLocalDateIso(new Date(), timeZone);
}

export function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isValidDateIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function minutesToHHMM(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function formatLocalTime(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return minutesToHHMM(p.hour * 60 + p.minute);
}

export function formatDateSr(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return `${WEEKDAYS_SR[isoWeekdayOf(dateIso)]}, ${d}.${m}.${y}.`;
}

/** Local calendar date (YYYY-MM-DD) of an instant in timeZone. */
export function formatLocalDateIso(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
