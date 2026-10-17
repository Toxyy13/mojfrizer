import type { NextRequest } from "next/server";

/** CSRF guard for cookie-authenticated API routes: a browser always sends Origin on cross-site writes. */
export function isSameSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin || origin.endsWith(`.${process.env.ROOT_DOMAIN ?? "mojfrizer.com"}`);
}
