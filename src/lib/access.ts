import { redirect } from "next/navigation";
import type { Salon } from "@prisma/client";
import { db } from "./db";
import { getSessionUser, type SessionUser } from "./auth";

export interface SalonAccess {
  user: SessionUser;
  salon: Salon;
}

/**
 * Tenant guard: every admin page and action must call this first.
 * Grants access only to the salon owner or a worker linked to that salon.
 */
export async function requireSalonAccess(slug: string): Promise<SalonAccess> {
  const user = await getSessionUser();
  if (!user) redirect("/prijava");
  const salon = await db.salon.findFirst({
    where: {
      slug,
      OR: [{ ownerId: user.id }, { workers: { some: { userId: user.id, isActive: true } } }],
    },
  });
  if (!salon) redirect("/admin");
  return { user, salon };
}

/** Non-redirecting variant for API routes. */
export async function hasSalonAccess(salonId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  const count = await db.salon.count({
    where: { id: salonId, OR: [{ ownerId: user.id }, { workers: { some: { userId: user.id, isActive: true } } }] },
  });
  return count > 0;
}
