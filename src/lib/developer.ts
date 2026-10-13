import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "./db";
import { getSessionUser, type SessionUser } from "./auth";

/**
 * Platform guard: every /razvoj page and action must call this first.
 * The role is read from the database, not from the session cookie, so a stale cookie
 * never grants (or keeps) developer rights. Everyone else gets a plain 404.
 */
export async function requireDeveloper(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) notFound();
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, email: true, name: true, role: true } });
  if (!user || user.role !== Role.DEVELOPER) notFound();
  return user;
}
