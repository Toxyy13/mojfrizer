import { Prisma } from "@prisma/client";
import { db, systemDb } from "./db";
import { formatPhone, normalizePhone } from "./phone";
import { TIME_ZONE, formatLocalDateIso } from "./time";

// A salon's customer list is built from its appointments. One customer = one clientKey:
// the last 8 phone digits (so "064 123 4567" and "+381 64 1234567" match, guest or account),
// or the account id when a booking has no phone.

/**
 * SQL expression for an appointment's clientKey; keep in sync with clientKeyOf.
 * Needs "appointments a LEFT JOIN users u ON u.id = a.clientId" in the query.
 */
const KEY_SQL = Prisma.sql`CASE
  WHEN length(regexp_replace(coalesce(a."guestPhone", u.phone, ''), '\\D', '', 'g')) >= 6
    THEN 'p:' || right(regexp_replace(coalesce(a."guestPhone", u.phone), '\\D', '', 'g'), 8)
  WHEN a."clientId" IS NOT NULL THEN 'u:' || a."clientId"
  ELSE 'a:' || a.id
END`;

interface KeySource {
  id: string;
  guestPhone: string | null;
  clientId: string | null;
  client?: { phone: string | null } | null;
}

export function clientKeyOf(a: KeySource): string {
  const digits = (a.guestPhone ?? a.client?.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 6) return `p:${digits.slice(-8)}`;
  if (a.clientId) return `u:${a.clientId}`;
  return `a:${a.id}`;
}

export function isValidClientKey(key: string): boolean {
  return /^(p:\d{6,8}|u:[a-z0-9]{10,40}|a:[a-z0-9]{10,40})$/.test(key);
}

export interface ClientSummary {
  key: string;
  name: string;
  phone: string | null;
  hasAccount: boolean;
  visits: number; // completed
  noShows: number;
  cancelled: number;
  spentPara: number; // sum of completed
  firstVisit: Date;
  lastVisit: Date | null; // last completed
  nextVisit: Date | null; // next booked
  note: string | null;
  blockedOnline: boolean;
}

interface Row {
  key: string;
  name: string;
  phone: string | null;
  has_account: boolean;
  visits: bigint;
  no_shows: bigint;
  cancelled: bigint;
  spent: bigint | null;
  first_visit: Date;
  last_visit: Date | null;
  next_visit: Date | null;
  note: string | null;
  blocked: boolean | null;
}

/** All customers of a salon with visit stats, newest activity first. Optional search by name or phone. */
export async function listSalonClients(salonId: string, search = "", key?: string): Promise<ClientSummary[]> {
  const term = search.trim();
  const digits = term.replace(/\D/g, "");
  const now = new Date();
  const rows = await db.$queryRaw<Row[]>`
    WITH keyed AS (
      SELECT ${KEY_SQL} AS key, a.*, u.name AS account_name, u.phone AS account_phone
      FROM appointments a
      LEFT JOIN users u ON u.id = a."clientId"
      WHERE a."salonId" = ${salonId}
    )
    SELECT
      k.key,
      (array_agg(coalesce(k."guestName", k.account_name, 'Mušterija') ORDER BY k."startTime" DESC))[1] AS name,
      (array_agg(coalesce(k."guestPhone", k.account_phone) ORDER BY k."startTime" DESC)
        FILTER (WHERE coalesce(k."guestPhone", k.account_phone) IS NOT NULL))[1] AS phone,
      bool_or(k."clientId" IS NOT NULL) AS has_account,
      count(*) FILTER (WHERE k.status = 'COMPLETED') AS visits,
      count(*) FILTER (WHERE k.status = 'NO_SHOW') AS no_shows,
      count(*) FILTER (WHERE k.status = 'CANCELLED') AS cancelled,
      sum(k.price) FILTER (WHERE k.status = 'COMPLETED') AS spent,
      min(k."startTime") AS first_visit,
      max(k."startTime") FILTER (WHERE k.status = 'COMPLETED') AS last_visit,
      min(k."startTime") FILTER (WHERE k.status = 'BOOKED' AND k."startTime" >= ${now}) AS next_visit,
      n.note,
      n."blockedOnline" AS blocked
    FROM keyed k
    LEFT JOIN salon_client_notes n ON n."salonId" = ${salonId} AND n."clientKey" = k.key
    GROUP BY k.key, n.note, n."blockedOnline"
    HAVING (${key ?? null}::text IS NULL OR k.key = ${key ?? null})
      AND (
        ${term} = ''
        OR bool_or(coalesce(k."guestName", k.account_name, '') ILIKE ${`%${term}%`})
        OR (${digits} <> '' AND bool_or(regexp_replace(coalesce(k."guestPhone", k.account_phone, ''), '\\D', '', 'g') LIKE ${`%${digits}%`}))
      )
    ORDER BY greatest(max(k."startTime"), min(k."createdAt")) DESC
    LIMIT 500
  `;
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    phone: r.phone,
    hasAccount: r.has_account,
    visits: Number(r.visits),
    noShows: Number(r.no_shows),
    cancelled: Number(r.cancelled),
    spentPara: Number(r.spent ?? 0),
    firstVisit: r.first_visit,
    lastVisit: r.last_visit,
    nextVisit: r.next_visit,
    note: r.note,
    blockedOnline: r.blocked ?? false,
  }));
}

/** No-show counts and notes for the customers on a day's schedule, keyed by clientKey. */
export async function clientFlags(
  salonId: string,
  keys: string[],
): Promise<Map<string, { noShows: number; note: string | null; blockedOnline: boolean }>> {
  const result = new Map<string, { noShows: number; note: string | null; blockedOnline: boolean }>();
  if (keys.length === 0) return result;
  const unique = [...new Set(keys)];
  const [counts, notes] = await Promise.all([
    db.$queryRaw<Array<{ key: string; no_shows: bigint }>>`
      SELECT key, count(*) AS no_shows FROM (
        SELECT ${KEY_SQL} AS key FROM appointments a LEFT JOIN users u ON u.id = a."clientId" WHERE a."salonId" = ${salonId} AND a.status = 'NO_SHOW'
      ) t WHERE key IN (${Prisma.join(unique)}) GROUP BY key`,
    db.salonClientNote.findMany({ where: { salonId, clientKey: { in: unique } } }),
  ]);
  for (const k of unique) result.set(k, { noShows: 0, note: null, blockedOnline: false });
  for (const c of counts) result.get(c.key)!.noShows = Number(c.no_shows);
  for (const n of notes) Object.assign(result.get(n.clientKey)!, { note: n.note, blockedOnline: n.blockedOnline });
  return result;
}

/** True when the salon asked this customer to book by phone instead of online. */
export async function isBlockedOnline(
  salonId: string,
  who: { guestPhone: string | null; clientId: string | null },
): Promise<boolean> {
  const keys = [clientKeyOf({ ...who, id: "none" })];
  if (who.clientId) keys.push(`u:${who.clientId}`);
  // Asked on behalf of a visitor, who may not read the salon's private notes: system access (RLS). Answers only yes or no.
  const count = await systemDb.salonClientNote.count({ where: { salonId, clientKey: { in: keys }, blockedOnline: true } });
  return count > 0;
}

export function shortDate(date: Date | null): string {
  if (!date) return "—";
  const [y, m, d] = formatLocalDateIso(date, TIME_ZONE).split("-");
  return `${Number(d)}.${Number(m)}.${y}.`;
}

export function displayPhone(phone: string | null): string {
  if (!phone) return "bez telefona";
  const normalized = normalizePhone(phone);
  return normalized ? formatPhone(normalized) : phone;
}

/** Ids of all of a customer's appointments in a salon, newest first. */
export async function appointmentIdsForClient(salonId: string, key: string): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT a.id FROM appointments a
    LEFT JOIN users u ON u.id = a."clientId"
    WHERE a."salonId" = ${salonId} AND ${KEY_SQL} = ${key}
    ORDER BY a."startTime" DESC
    LIMIT 500`;
  return rows.map((r) => r.id);
}
