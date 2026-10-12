import { NextResponse, type NextRequest } from "next/server";
import { isGoogleConfigured, OAUTH_COOKIE, OAUTH_COOKIE_SECONDS, startAuthorization } from "@/lib/google";
import { safeNextPath } from "@/lib/landing";

export const dynamic = "force-dynamic";

/** Starts "Continue with Google": remembers state + PKCE verifier in a short-lived cookie. */
export function GET(request: NextRequest): NextResponse {
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/prijava?greska=google", request.nextUrl.origin));
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
