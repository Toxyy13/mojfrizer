import { db } from "./db";

/** Only same-site relative paths, so ?next= can't send people to another domain. */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * Where a user goes right after login: their favorite salon first,
 * the salon panel for owners and staff, otherwise salon search.
 */
export async function landingPathFor(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      favoriteSalon: { select: { slug: true, isActive: true } },
      _count: { select: { ownedSalons: true, workerProfiles: true } },
    },
  });
  if (user?.favoriteSalon?.isActive) return `/s/${user.favoriteSalon.slug}`;
  if (user && user._count.ownedSalons + user._count.workerProfiles > 0) return "/admin";
  return "/search";
}
