import { cookies } from "next/headers";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { systemDb } from "./db";
import { looksLikeEmail, normalizePhone } from "./phone";
import { SESSION_COOKIE, currentSessionClaims, secretKey } from "./sessionToken";

const COOKIE_NAME = SESSION_COOKIE;
const SESSION_DAYS = 7;
/** bcrypt only reads the first 72 bytes; capping the input also stops huge passwords from being used to burn CPU. */
export const MAX_PASSWORD_LENGTH = 72;
const BCRYPT_COST = 12;
let dummyHash: string | undefined;

export interface SessionUser {
  id: string;
  // Customers who signed up with a phone number have no email.
  email: string | null;
  name: string;
  role: Role;
}

/** Looks up a user by email (salon staff) or phone (customers) and checks the password. */
export async function verifyCredentials(login: string, password: string): Promise<SessionUser | null> {
  const trimmed = login.trim();
  const phone = looksLikeEmail(trimmed) ? null : normalizePhone(trimmed);
  if (!phone && !looksLikeEmail(trimmed)) return null;
  const where = phone ? { phone } : { email: trimmed.toLowerCase() };
  // Login happens before anyone is identified: trusted lookup that bypasses RLS (see rls.ts).
  const user = await systemDb.user.findUnique({
    where,
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });
  // Unknown accounts cost the same time as wrong passwords, so response time doesn't reveal which emails exist.
  const ok = await bcrypt.compare(password.slice(0, MAX_PASSWORD_LENGTH), user?.passwordHash ?? (dummyHash ??= bcrypt.hashSync("dummy-password-for-timing", BCRYPT_COST)));
  if (!user?.passwordHash) return null;
  return ok ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
}

/** Sets the session cookie for an already verified user. */
export async function startSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return currentSessionClaims();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password.slice(0, MAX_PASSWORD_LENGTH), BCRYPT_COST);
}
