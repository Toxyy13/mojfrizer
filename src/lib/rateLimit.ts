import { headers } from "next/headers";
// Counters are system data: they never depend on who is logged in (see src/lib/rls.ts).
import { systemDb } from "./db";

// Abuse protection. Fixed-window counters kept in PostgreSQL, so the limits hold across all serverless instances
// (an in-memory counter would reset on every cold start and differ per instance).

export interface Rule {
  /** Namespaced key, e.g. `login:ip:1.2.3.4`. */
  key: string;
  limit: number;
  windowSec: number;
}

export interface LimitResult {
  ok: boolean;
  /** Seconds until the blocking window ends (0 when ok). */
  retryAfterSec: number;
}

const OK: LimitResult = { ok: true, retryAfterSec: 0 };

interface Row {
  count: number;
  retryAfterSec: number;
}

/** Adds one hit to every rule and reports whether any limit is exceeded. */
export async function consume(rules: Rule[]): Promise<LimitResult> {
  let worst = OK;
  for (const rule of rules) {
    try {
      const [row] = await systemDb.$queryRaw<Row[]>`
        INSERT INTO rate_limits ("key", "count", "windowStart") VALUES (${rule.key}, 1, now())
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN rate_limits."windowStart" < now() - make_interval(secs => ${rule.windowSec}) THEN 1 ELSE rate_limits."count" + 1 END,
          "windowStart" = CASE WHEN rate_limits."windowStart" < now() - make_interval(secs => ${rule.windowSec}) THEN now() ELSE rate_limits."windowStart" END
        RETURNING "count", ceil(extract(epoch FROM ("windowStart" + make_interval(secs => ${rule.windowSec}) - now())))::int AS "retryAfterSec"`;
      if (row && row.count > rule.limit && !(worst.retryAfterSec > row.retryAfterSec)) worst = { ok: false, retryAfterSec: Math.max(1, row.retryAfterSec) };
    } catch (error) {
      // A broken counter must not lock every visitor out; the failure is logged and the request goes through.
      console.error("rate limit check failed", error);
    }
  }
  return worst;
}

/** Whether a key is already over its limit, without counting this call (for "failures only" counters). */
export async function isBlocked(rule: Rule): Promise<LimitResult> {
  try {
    const [row] = await systemDb.$queryRaw<Row[]>`
      SELECT "count", ceil(extract(epoch FROM ("windowStart" + make_interval(secs => ${rule.windowSec}) - now())))::int AS "retryAfterSec"
      FROM rate_limits WHERE "key" = ${rule.key} AND "windowStart" >= now() - make_interval(secs => ${rule.windowSec})`;
    return row && row.count >= rule.limit ? { ok: false, retryAfterSec: Math.max(1, row.retryAfterSec) } : OK;
  } catch (error) {
    console.error("rate limit check failed", error);
    return OK;
  }
}

/** How many hits a key has in its current window (0 when none), for "N attempts left" hints. */
export async function hitCount(rule: Rule): Promise<number> {
  try {
    const [row] = await systemDb.$queryRaw<{ count: number }[]>`
      SELECT "count" FROM rate_limits WHERE "key" = ${rule.key} AND "windowStart" >= now() - make_interval(secs => ${rule.windowSec})`;
    return row?.count ?? 0;
  } catch (error) {
    console.error("rate limit check failed", error);
    return 0;
  }
}

/** Counts one hit without checking (a failed login, after the attempt). */
export async function recordHit(rule: Rule): Promise<void> {
  await consume([rule]);
}

/** Forgets a key (a successful login clears the failure counters). */
export async function clearLimit(...keys: string[]): Promise<void> {
  try {
    await systemDb.rateLimit.deleteMany({ where: { key: { in: keys } } });
  } catch (error) {
    console.error("rate limit reset failed", error);
  }
}

/** Forgets every key that starts with a prefix (e.g. an account's counters from all addresses). */
export async function clearLimitPrefix(prefix: string): Promise<void> {
  try {
    await systemDb.rateLimit.deleteMany({ where: { key: { startsWith: prefix } } });
  } catch (error) {
    console.error("rate limit reset failed", error);
  }
}

/** Deletes counters whose window is long over (called by the cron job). */
export async function purgeRateLimits(): Promise<number> {
  const { count } = await systemDb.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 24 * 3_600_000) } } });
  return count;
}

/** Address of the caller. Vercel sets these headers itself and drops any value the client sent. */
export function ipFrom(get: (name: string) => string | null): string {
  const raw = get("x-vercel-forwarded-for") ?? get("x-real-ip") ?? get("x-forwarded-for") ?? "";
  const first = raw.split(",")[0].trim();
  // Keys only ever hold what looks like an address, so a crafted header can't fill the table with junk.
  return /^[0-9a-fA-F:.]{2,45}$/.test(first) ? first.toLowerCase() : "unknown";
}

/** Address of the current request (server actions and route handlers); "unknown" outside a request. */
export async function requestIp(): Promise<string> {
  try {
    const h = await headers();
    return ipFrom((name) => h.get(name));
  } catch {
    return "unknown";
  }
}

/** Short stable form of free text (an email, a phone) for use inside a key. */
export function keyPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9@.+_-]/g, "").slice(0, 80);
}

export const TOO_MANY = "Previše pokušaja. Sačekajte malo pa pokušajte ponovo.";

/** Message with the wait time, for forms. */
export function waitMessage(result: LimitResult): string {
  const minutes = Math.ceil(result.retryAfterSec / 60);
  return minutes <= 1 ? "Previše pokušaja. Pokušajte ponovo za minut." : `Previše pokušaja. Pokušajte ponovo za ${minutes} min.`;
}
