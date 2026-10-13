import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryScrub";

// Error monitoring (Sentry), server side only: Node and Edge. The browser SDK is deliberately not installed,
// so no visitor's IP address or page content ever goes to a third party from their device.
// Off unless SENTRY_DSN is set (Vercel → Environment Variables).
export function register(): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init(sentryOptions());
}

export const onRequestError = Sentry.captureRequestError;
