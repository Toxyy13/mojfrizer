import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { Role } from "@prisma/client";

// Reading the login cookie. Kept free of database access so the database layer (db.ts) can use it to learn who is asking.

export const SESSION_COOKIE = "mf_session";

export interface SessionClaims {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  /** When the cookie was issued (epoch seconds). */
  issuedAt: number;
}

export function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars)");
  return new TextEncoder().encode(secret);
}

/** Verifies a session token; null when it is missing, forged or expired. */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    const role = payload.role === "ADMIN" || payload.role === "WORKER" || payload.role === "DEVELOPER" ? payload.role : "CLIENT";
    const email = typeof payload.email === "string" ? payload.email : null;
    return { id: payload.sub, email, name: String(payload.name), role, issuedAt: typeof payload.iat === "number" ? payload.iat : 0 };
  } catch {
    return null;
  }
}

/**
 * The logged-in user of the current request, or null. Outside a request (scripts, tests, build) there is no cookie
 * jar, which counts as "nobody logged in". Any other error (for example Next's signal that a page must render
 * dynamically) is rethrown untouched.
 */
export async function currentSessionClaims(): Promise<SessionClaims | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  } catch (error) {
    if (error instanceof Error && /outside a request scope/i.test(error.message)) return null;
    throw error;
  }
  return verifySessionToken(token);
}
