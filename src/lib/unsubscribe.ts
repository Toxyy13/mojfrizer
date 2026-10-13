import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "./appUrl";
// Trusted internal code (tokens, mail, cron, login): runs with RLS bypass, see src/lib/rls.ts.
import { systemDb as db } from "./db";

// One-click unsubscribe links for optional emails (reminders, waitlist). The link carries the user id and an
// HMAC of it, so it works without logging in and can't be guessed for other people.

function sign(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars)");
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url");
}

export function unsubscribeUrl(userId: string): string {
  return `${appUrl()}/odjava-mejlova?u=${encodeURIComponent(userId)}&t=${sign(userId)}`;
}

/** Address for the List-Unsubscribe one-click POST (mail clients show their own "Unsubscribe" button). */
export function unsubscribePostUrl(userId: string): string {
  return `${appUrl()}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${sign(userId)}`;
}

export function isValidUnsubscribe(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function unsubscribeUser(userId: string): Promise<boolean> {
  const result = await db.user.updateMany({ where: { id: userId }, data: { emailOptOut: true } });
  return result.count > 0;
}
