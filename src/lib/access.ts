import { redirect } from "next/navigation";
import type { Salon } from "@prisma/client";
import { db } from "./db";
import { getSessionUser, type SessionUser } from "./auth";

export interface SalonAccess {
  user: SessionUser;
  salon: Salon;
  /** Set for a staff login: the only schedule that user may see and manage. Null for the owner. */
  staffWorkerId: string | null;
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
  if (salon.ownerId === user.id) return { user, salon, staffWorkerId: null };
  const worker = await db.workerProfile.findFirst({
    where: { salonId: salon.id, userId: user.id, isActive: true },
    select: { id: true },
  });
  if (!worker) redirect("/admin");
  return { user, salon, staffWorkerId: worker.id };
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

/** Settings, reports, customer cards and chat belong to the owner; staff logins see only their own schedule. */
export async function requireSalonOwner(slug: string): Promise<SalonAccess> {
  const access = await requireSalonAccess(slug);
  if (access.salon.ownerId !== access.user.id) redirect(`/admin/${slug}`);
  return access;
}
