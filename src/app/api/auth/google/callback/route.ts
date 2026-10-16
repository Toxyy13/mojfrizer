import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/appUrl";
import { startSession } from "@/lib/auth";
import { fetchProfile, OAUTH_COOKIE, userForProfile, type OAuthAttempt } from "@/lib/google";
import { landingPathFor, safeNextPath } from "@/lib/landing";
import { consume, requestIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function readAttempt(request: NextRequest): OAuthAttempt | null {
  try {
    const raw = request.cookies.get(OAUTH_COOKIE)?.value;
    const parsed = raw ? (JSON.parse(raw) as Partial<OAuthAttempt>) : null;
    if (!parsed || typeof parsed.state !== "string" || typeof parsed.verifier !== "string") return null;
    return { state: parsed.state, verifier: parsed.verifier, next: safeNextPath(parsed.next) };
  } catch {
    return null;
  }
}

/** Google sends the browser back here with ?code=…&state=… */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = appUrl(request.nextUrl.origin);
  const fail = (): NextResponse => {
    const response = NextResponse.redirect(new URL("/prijava?greska=google", origin));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return response;
  };

  if (!(await consume([{ key: `google-cb:ip:${await requestIp()}`, limit: 30, windowSec: 600 }])).ok) return fail();
  const attempt = readAttempt(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!attempt || !code || state !== attempt.state) return fail();

  try {
    const profile = await fetchProfile(code, attempt.verifier, request.nextUrl.origin);
    const user = await userForProfile(profile);
    // The session cookie is set through next/headers, which Next merges into this response.
    await startSession(user);
    const target = attempt.next ?? (await landingPathFor(user));
    const response = NextResponse.redirect(new URL(target, origin));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return response;
  } catch (error) {
    console.error(error);
    return fail();
  }
}
