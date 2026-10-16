import { createHash, randomBytes } from "node:crypto";
import { decodeJwt } from "jose";
import { Prisma, Role } from "@prisma/client";
import { appUrl } from "./appUrl";
import { TERMS_VERSION } from "./company";
// Trusted internal code (tokens, mail, cron, login): runs with RLS bypass, see src/lib/rls.ts.
import { systemDb as db } from "./db";
import type { SessionUser } from "./auth";

// Endpoints can be overridden in local tests; production uses Google's.
const AUTH_URL = process.env.GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const OAUTH_COOKIE = "mf_oauth";
export const OAUTH_COOKIE_SECONDS = 600;

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  return { clientId, clientSecret };
}

export function redirectUri(fallbackOrigin: string): string {
  return `${appUrl(fallbackOrigin)}/api/auth/google/callback`;
}

const base64Url = (buffer: Buffer): string => buffer.toString("base64url");

export interface OAuthAttempt {
  state: string;
  verifier: string;
  next: string | null;
}

/** New state + PKCE verifier, and the Google URL to send the browser to. */
export function startAuthorization(next: string | null, fallbackOrigin: string): { attempt: OAuthAttempt; url: string } {
  const { clientId } = credentials();
  const attempt: OAuthAttempt = { state: base64Url(randomBytes(24)), verifier: base64Url(randomBytes(32)), next };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(fallbackOrigin),
    response_type: "code",
    scope: "openid email profile",
    state: attempt.state,
    code_challenge: base64Url(createHash("sha256").update(attempt.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { attempt, url: url.toString() };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

/** Exchanges the code and reads the ID token that Google returned directly over TLS. */
export async function fetchProfile(code: string, verifier: string, fallbackOrigin: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(fallbackOrigin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error(`Google token endpoint answered ${response.status}`);
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google did not return an id_token");

  const claims = decodeJwt(body.id_token);
  if (!claims.iss || !ISSUERS.includes(claims.iss)) throw new Error("Unexpected token issuer");
  if (claims.aud !== clientId) throw new Error("Token was issued for another client");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("Token expired");
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("Token has no email");
  if (claims.email_verified !== true) throw new Error("Google email is not verified");
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : claims.email.split("@")[0];
  return { sub: claims.sub, email: claims.email.toLowerCase(), name };
}

/**
 * Finds the account for a Google profile: by Google id, else by the (Google-verified) email,
 * else creates a new customer account.
 */
export async function userForProfile(profile: GoogleProfile): Promise<SessionUser> {
  const select = { id: true, email: true, name: true, role: true } as const;
  const byGoogle = await db.user.findUnique({ where: { googleId: profile.sub }, select });
  if (byGoogle) return byGoogle;

  const byEmail = await db.user.findUnique({ where: { email: profile.email }, select: { ...select, emailVerifiedAt: true } });
  if (byEmail) {
    await db.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        // An account whose email was never confirmed may have been registered by someone else with this address
        // (and their password). Google proves the real owner, so that password and old sessions are dropped.
        ...(byEmail.emailVerifiedAt ? {} : { passwordHash: null, sessionsValidAfter: new Date() }),
      },
    });
    return { id: byEmail.id, email: byEmail.email, name: byEmail.name, role: byEmail.role };
  }
  try {
    return await db.user.create({
      data: { email: profile.email, name: profile.name, googleId: profile.sub, emailVerifiedAt: new Date(), role: Role.CLIENT, termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
      select,
    });
  } catch (error) {
    // Two simultaneous first sign-ins: the other request created it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.user.findFirst({
        where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
        select,
      });
      if (existing) return existing;
    }
    throw error;
  }
}
