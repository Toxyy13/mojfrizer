import { Prisma, PrismaClient } from "@prisma/client";
import { isRlsEnforced, requestIdentity, scopedIdentity, type DbIdentity } from "./rls";

// One client for the whole app. With RLS_ENFORCE=1 every query is wrapped in a short transaction that first
// switches to the restricted role `mojfrizer_app` and tells the policies who is asking (see rls.ts). Without it the
// client is the plain PrismaClient and connects as the table owner, which PostgreSQL does not restrict.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const base: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

type AnyFn = (...args: unknown[]) => unknown;

// Prisma loads `include`/nested `select` as one extra query per relation by default. With the join strategy the whole
// tree is one SQL statement, which is one network round trip to the database instead of several (and with RLS every
// statement costs four round trips, see defer()).
const JOIN_OPERATIONS = new Set(["findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "findMany"]);
function withJoinStrategy(operation: string, args: unknown[]): unknown[] {
  const first = args[0];
  if (!JOIN_OPERATIONS.has(operation) || typeof first !== "object" || first === null) return args;
  const query = first as { include?: unknown; select?: unknown; relationLoadStrategy?: unknown };
  if (query.relationLoadStrategy !== undefined || (!query.include && !query.select)) return args;
  return [{ ...query, relationLoadStrategy: "join" }, ...args.slice(1)];
}

function plainClient(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof prop !== "string" || prop.startsWith("$") || prop.startsWith("_") || typeof value !== "object" || value === null) {
        return typeof value === "function" ? (value as AnyFn).bind(target) : value;
      }
      return new Proxy(value, {
        get(model, operation) {
          const fn = Reflect.get(model, operation);
          if (typeof fn !== "function" || typeof operation !== "string") return fn;
          return (...args: unknown[]) => (fn as AnyFn).apply(model, withJoinStrategy(operation, args));
        },
      });
    },
  }) as PrismaClient;
}
const RAW = Symbol("rawPrismaPromise");

interface Deferred<T> extends PromiseLike<T> {
  [RAW]: PromiseLike<unknown>;
  catch: Promise<T>["catch"];
  finally: Promise<T>["finally"];
}

/** SQL that makes the next statements in this transaction run as the restricted role for `identity`. */
function contextQuery(client: Prisma.TransactionClient | PrismaClient, identity: DbIdentity) {
  return client.$executeRaw`select set_config('role', 'mojfrizer_app', true), set_config('app.uid', ${identity.uid}, true), set_config('app.sys', ${identity.sys ? "on" : ""}, true), set_config('app.devclaim', ${identity.devClaim ? "on" : ""}, true)`;
}

/**
 * Like a PrismaPromise, the query only runs when awaited. When awaited it runs inside a transaction together with the
 * context statement. Inside `$transaction([...])` the original lazy query is handed over instead (see below).
 */
function defer<T>(raw: PromiseLike<T>, resolveIdentity: IdentitySource): Deferred<T> {
  // A runAsSystem()/runAsUser() scope is read now: the query usually runs later, after the scope callback returned.
  const scoped = scopedIdentity();
  let started: Promise<T> | undefined;
  const run = (): Promise<T> =>
    (started ??= (async () => {
      const identity = await resolveIdentity(scoped);
      // System access needs no role switch: the owner connection is not subject to RLS, so skip the extra round trips.
      if (identity.sys) return raw as Prisma.PrismaPromise<T>;
      const results = await base.$transaction([contextQuery(base, identity), raw as Prisma.PrismaPromise<T>]);
      return results[1] as T;
    })());
  return {
    [RAW]: raw,
    then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
    catch: (onRejected) => run().catch(onRejected),
    finally: (onFinally) => run().finally(onFinally),
  } as Deferred<T>;
}

function isDeferred(value: unknown): value is Deferred<unknown> {
  return typeof value === "object" && value !== null && RAW in value;
}

type IdentitySource = (scoped: DbIdentity | undefined) => Promise<DbIdentity>;

function enforcedClient(resolveIdentity: IdentitySource): PrismaClient {
  const transaction = (arg: unknown, options?: unknown): unknown => {
    if (typeof arg === "function") {
      // Interactive transaction: set the context first, then hand the callback the plain transaction client.
      const scoped = scopedIdentity();
      return base.$transaction(async (tx) => {
        const identity = await resolveIdentity(scoped);
        if (!identity.sys) await contextQuery(tx, identity);
        return (arg as (tx: Prisma.TransactionClient) => Promise<unknown>)(tx);
      }, options as never);
    }
    const operations = (arg as unknown[]).map((op) => (isDeferred(op) ? op[RAW] : op));
    const scoped = scopedIdentity();
    return (async () => {
      const identity = await resolveIdentity(scoped);
      if (identity.sys) return base.$transaction(operations as Prisma.PrismaPromise<unknown>[], options as never);
      const results = await base.$transaction([contextQuery(base, identity), ...(operations as Prisma.PrismaPromise<unknown>[])], options as never);
      return results.slice(1);
    })();
  };

  const rawQuery = (name: "$queryRaw" | "$executeRaw" | "$queryRawUnsafe" | "$executeRawUnsafe") =>
    (...args: unknown[]) => defer((base[name] as AnyFn)(...args) as PromiseLike<unknown>, resolveIdentity);

  const modelProxy = (model: object): object =>
    new Proxy(model, {
      get(target, prop) {
        const value = Reflect.get(target, prop);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) =>
          defer((value as AnyFn).apply(target, typeof prop === "string" ? withJoinStrategy(prop, args) : args) as PromiseLike<unknown>, resolveIdentity);
      },
    });

  return new Proxy(base, {
    get(target, prop) {
      if (prop === "$transaction") return transaction;
      if (prop === "$queryRaw" || prop === "$executeRaw" || prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") return rawQuery(prop);
      const value = Reflect.get(target, prop);
      if (typeof prop === "string" && !prop.startsWith("$") && !prop.startsWith("_") && typeof value === "object" && value !== null) return modelProxy(value);
      return typeof value === "function" ? (value as AnyFn).bind(target) : value;
    },
  }) as PrismaClient;
}

/** The app's database client. Who is asking is read from the login cookie, or from runAsSystem()/runAsUser(). */
export const db: PrismaClient = isRlsEnforced() ? enforcedClient(async (scoped) => scoped ?? (await requestIdentity())) : plainClient(base);

/**
 * Client that always runs with RLS bypass, for modules that only contain trusted internal code
 * (cron, mail tokens, login). It is the plain owner connection, so it costs nothing extra.
 * Prefer it over scattering runAsSystem() when a whole file is system code.
 */
export const systemDb: PrismaClient = plainClient(base);

/** The unrestricted client: migrations, seed, scripts and tests that set up data. Never import it from request code. */
export const ownerDb: PrismaClient = base;
