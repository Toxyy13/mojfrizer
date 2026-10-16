import { NextResponse, type NextRequest } from "next/server";
import { isGoogleConfigured, OAUTH_COOKIE, OAUTH_COOKIE_SECONDS, startAuthorization } from "@/lib/google";
import { safeNextPath } from "@/lib/landing";
import { consume, requestIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Starts "Continue with Google": remembers state + PKCE verifier in a short-lived cookie. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/prijava?greska=google", request.nextUrl.origin));
  if (!(await consume([{ key: `google:ip:${await requestIp()}`, limit: 30, windowSec: 600 }])).ok) {
    return NextResponse.redirect(new URL("/prijava?greska=google", request.nextUrl.origin));
  }
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const { attempt, url } = startAuthorization(next, request.nextUrl.origin);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(attempt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: OAUTH_COOKIE_SECONDS,
  });
  return response;
}
