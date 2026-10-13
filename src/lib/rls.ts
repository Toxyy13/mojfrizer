import { AsyncLocalStorage } from "node:async_hooks";
import { currentSessionClaims } from "./sessionToken";

// Who is asking the database. Row Level Security policies (prisma/migrations/*_row_level_security) read two
// transaction-local settings that db.ts sets before every query:
//   app.uid  the logged-in user (empty for visitors)
//   app.sys  'on' only for trusted internal code, see runAsSystem()

export interface DbIdentity {
  uid: string;
  sys: boolean;
  /** The login cookie says the user is the platform developer; the database re-checks it (app_sys()). */
  devClaim?: boolean;
}

const store = new AsyncLocalStorage<DbIdentity>();

/** True when queries run as the restricted role. Off by default so the switch can be thrown after deploying the migration. */
export function isRlsEnforced(): boolean {
  return process.env.RLS_ENFORCE === "1";
}

/**
 * Runs `fn` with full database access (RLS bypass). Use it only after the caller has been authorised by other means,
 * for code that has to look across salons or people on behalf of someone who is not allowed to:
 * login and registration, booking on behalf of a visitor, links with a secret token, cron jobs, the developer panel.
 * Everything called inside `fn` inherits the bypass.
 */
export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ uid: "", sys: true }, async () => await fn());
}

/** Runs `fn` as one specific user (for tests and background jobs acting on behalf of a person). */
export function runAsUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ uid, sys: false }, async () => await fn());
}

/** The runAsSystem/runAsUser scope the caller is in right now, if any. Read synchronously when a query is created. */
export function scopedIdentity(): DbIdentity | undefined {
  return store.getStore();
}

/** Identity of the current request from its login cookie (nobody outside a request). */
export async function requestIdentity(): Promise<DbIdentity> {
  const claims = await currentSessionClaims();
  return { uid: claims?.id ?? "", sys: false, devClaim: claims?.role === "DEVELOPER" };
}
