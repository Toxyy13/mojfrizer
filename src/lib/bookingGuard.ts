import { systemDb } from "./db";
import { consume, keyPart, requestIp, TOO_MANY } from "./rateLimit";

// Stops a visitor from filling a salon's calendar with fake bookings or flooding its urgent-request list.

/** Most upcoming online bookings one person (phone number or account) may hold in one salon. */
export const MAX_ACTIVE_ONLINE_BOOKINGS = 5;
/** Most open urgent requests one person may have in one salon. */
export const MAX_OPEN_URGENT_REQUESTS = 3;

const lastDigits = (phone: string | null | undefined): string => (phone ?? "").replace(/\D/g, "").slice(-8);

/** How many upcoming, not yet cancelled online bookings this phone number or account already has in the salon. */
export async function countActiveOnlineBookings(salonId: string, phone: string | null, clientId: string | null): Promise<number> {
  const key = lastDigits(phone);
  const rows = await systemDb.appointment.findMany({
    where: { salonId, source: "ONLINE", status: "BOOKED", startTime: { gt: new Date() } },
    select: { guestPhone: true, clientId: true },
    take: 1000,
  });
  return rows.filter((r) => (clientId !== null && r.clientId === clientId) || (key.length >= 6 && lastDigits(r.guestPhone) === key)).length;
}

export async function countOpenUrgentRequests(salonId: string, phone: string | null, clientId: string | null): Promise<number> {
  const key = lastDigits(phone);
  const rows = await systemDb.urgentRequest.findMany({
    where: { salonId, status: "PENDING" },
    select: { guestPhone: true, clientId: true },
    take: 1000,
  });
  return rows.filter((r) => (clientId !== null && r.clientId === clientId) || (key.length >= 6 && lastDigits(r.guestPhone) === key)).length;
}

/** Request-rate limits for a booking or urgent request from this address and phone number. Returns an error text, or null. */
export async function checkVisitorLimits(kind: "book" | "urgent", phone: string | null): Promise<string | null> {
  const ip = await requestIp();
  const rules = [{ key: `${kind}:ip:${ip}`, limit: kind === "book" ? 12 : 6, windowSec: 3600 }];
  const digits = lastDigits(phone);
  if (digits.length >= 6) rules.push({ key: `${kind}:phone:${keyPart(digits)}`, limit: kind === "book" ? 8 : 4, windowSec: 86_400 });
  return (await consume(rules)).ok ? null : TOO_MANY;
}
