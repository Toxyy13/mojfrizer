import type { ErrorEvent } from "@sentry/core";

// Error monitoring must never carry personal data: emails, phone numbers, names, message text, passwords, tokens.
// We send only the error type, message and stack, the route name and the release. Everything else is removed here,
// and any string that is left is stripped of anything that looks like an email, phone number or secret token.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// +381 64 123 4567, 064/123-4567, 0641234567 ...
const PHONE = /(?:\+|00)?\d[\d\s/().-]{7,}\d/g;
// Long hex or url-safe strings: manage links, QR tokens, password-reset and verification tokens, session JWTs.
const TOKEN = /\b[A-Za-z0-9_-]{24,}\b/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;
// Paths that carry a secret in the URL.
const SECRET_PATHS = /\/(termin|q)\/[^/?#\s]+/g;

export function scrubString(value: string): string {
  return value
    .replace(JWT, "[token]")
    .replace(EMAIL, "[email]")
    .replace(SECRET_PATHS, "/$1/[token]")
    .replace(TOKEN, "[token]")
    .replace(PHONE, "[phone]");
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubString(value);
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = scrubDeep(item, depth + 1);
  return out;
}

/** Sentry `beforeSend`: strips personal data from an error event before it leaves the server. */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  // Whole sections that only ever hold personal data are dropped, not filtered.
  delete event.user;
  delete event.server_name;
  delete event.extra;
  if (event.request) {
    const url = event.request.url ? scrubString(event.request.url.split("?")[0].split("#")[0]) : undefined;
    event.request = { url, method: event.request.method };
  }
  if (event.contexts) {
    // Keep runtime/os for debugging, drop anything else (e.g. request-bound custom contexts).
    const { runtime, os } = event.contexts;
    event.contexts = { ...(runtime ? { runtime } : {}), ...(os ? { os } : {}) };
  }
  event.breadcrumbs = (event.breadcrumbs ?? []).map((crumb) => ({
    ...crumb,
    message: crumb.message ? scrubString(crumb.message) : crumb.message,
    data: undefined,
  }));
  if (event.message) event.message = scrubString(event.message);
  if (event.transaction) event.transaction = scrubString(event.transaction);
  if (event.exception?.values) {
    event.exception.values = scrubDeep(event.exception.values) as NonNullable<T["exception"]>["values"];
  }
  event.tags = event.tags ? (scrubDeep(event.tags) as typeof event.tags) : event.tags;
  return event;
}

/** Shared by the Node and Edge runtimes. Without SENTRY_DSN the SDK stays off and nothing is sent. */
export function sentryOptions() {
  const rate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  return {
    dsn: process.env.SENTRY_DSN || undefined,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    // No performance tracing unless explicitly asked for: spans carry URLs and queries.
    tracesSampleRate: Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : 0,
    beforeSend: scrubEvent,
    // Console logs and HTTP bodies can contain customer text.
    integrations: (defaults: Array<{ name: string }>) => defaults.filter((i) => i.name !== "Console"),
  };
}
