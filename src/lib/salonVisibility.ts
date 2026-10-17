import { randomBytes } from "node:crypto";
import { SalonVisibility } from "@prisma/client";
import { db, systemDb } from "./db";
import { getSessionUser, type SessionUser } from "./auth";

// Public/private salons. Every place that opens a salon for a visitor (page, slots, booking, chat, favorites,
// assistant) goes through canViewSalon / findViewableSalon, so the rule lives only here.

/** Prisma filter for lists and search: private salons never appear there. */
export const PUBLIC_SALONS = { visibility: SalonVisibility.PUBLIC } as const;

export interface ViewFacts {
  visibility: SalonVisibility;
  /** The viewer owns the salon or works there. */
  isStaff: boolean;
  /** The viewer scanned the salon's QR code. */
  isMember: boolean;
}

/** Salon logins (owner, hairdresser) work in their own salon only; they have no customer side of the platform. */
export function isSalonRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "WORKER";
}

/** Pure rule: salon logins open only their own salon; public salons are open to everyone else; private ones only to logged-in people connected to them. */
export function decideViewAccess(facts: ViewFacts, user: Pick<SessionUser, "role"> | null): boolean {
  if (user && isSalonRole(user.role)) return facts.isStaff;
  if (facts.visibility === SalonVisibility.PUBLIC) return true;
  if (!user) return false;
  return user.role === "DEVELOPER" || facts.isStaff || facts.isMember;
}

/** Whether this viewer may open the salon (page, slots, booking, chat). Anonymous viewers only see public salons. */
export async function canViewSalon(salonId: string, user: SessionUser | null): Promise<boolean> {
  const salon = await db.salon.findUnique({
    where: { id: salonId },
    select: {
      visibility: true,
      ownerId: true,
      workers: user ? { where: { userId: user.id, isActive: true }, select: { id: true } } : false,
      members: user ? { where: { userId: user.id }, select: { userId: true } } : false,
    },
  });
  if (!salon) return false;
  const isStaff = !!user && (salon.ownerId === user.id || (salon.workers?.length ?? 0) > 0);
  return decideViewAccess({ visibility: salon.visibility, isStaff, isMember: (salon.members?.length ?? 0) > 0 }, user);
}

export interface ViewableSalon {
  id: string;
  name: string;
  slug: string;
}

/** An active salon by slug, or null when it doesn't exist or the current visitor may not see it (callers answer 404). */
export async function findViewableSalon(slug: string): Promise<ViewableSalon | null> {
  const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true } });
  if (!salon) return null;
  return (await canViewSalon(salon.id, await getSessionUser())) ? salon : null;
}

/** New long unguessable token for the QR link (256 bits). */
export function newQrToken(): string {
  return randomBytes(32).toString("hex");
}

/** Connects a customer to a salon (scanned its QR) and makes it their favorite. */
export async function connectCustomerToSalon(userId: string, salonId: string): Promise<void> {
  // The QR token was checked by the caller; joining a (possibly private) salon is system work.
  await systemDb.$transaction([
    systemDb.salonMembership.upsert({ where: { userId_salonId: { userId, salonId } }, create: { userId, salonId }, update: {} }),
    systemDb.user.update({ where: { id: userId }, data: { favoriteSalonId: salonId } }),
  ]);
}
