import { createHash, randomBytes } from "node:crypto";
import type { EmailTokenKind } from "@prisma/client";
import { db } from "./db";

const LIFETIME_MS: Record<EmailTokenKind, number> = {
  VERIFY_EMAIL: 48 * 3_600_000,
  RESET_PASSWORD: 3_600_000,
};
// One mail of each kind per user per minute, so the forms can't be used to flood an inbox.
const MIN_GAP_MS = 60_000;

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Creates a one-time token and returns it (only its hash is stored); null when asked again too soon. */
export async function issueToken(userId: string, kind: EmailTokenKind): Promise<string | null> {
  const recent = await db.emailToken.findFirst({
    where: { userId, kind, createdAt: { gt: new Date(Date.now() - MIN_GAP_MS) } },
    select: { id: true },
  });
  if (recent) return null;
  const token = randomBytes(32).toString("base64url");
  await db.emailToken.create({
    data: { userId, kind, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LIFETIME_MS[kind]) },
  });
  return token;
}

/** The user a still valid token belongs to, without using it up. */
export async function peekToken(token: string, kind: EmailTokenKind): Promise<{ userId: string } | null> {
  const row = await db.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  return { userId: row.userId };
}

/** Uses a token up exactly once. Returns the user it belonged to, or null if invalid, expired or already used. */
export async function consumeToken(token: string, kind: EmailTokenKind): Promise<{ userId: string } | null> {
  const row = await db.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== kind || row.expiresAt < new Date()) return null;
  // The updateMany filter makes two simultaneous clicks race safely: only one gets count 1.
  const { count } = await db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? { userId: row.userId } : null;
}
