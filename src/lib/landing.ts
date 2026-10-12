import type { SessionUser } from "./auth";
import { db } from "./db";

/** Only same-site relative paths, so ?next= can't send people to another domain. */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/** Where a user goes right after login: staff to the salon panel, customers to their favorite salon. */
export async function landingPathFor(user: SessionUser): Promise<string> {
  if (user.role !== "CLIENT") return "/admin";
  const found = await db.user.findUnique({
    where: { id: user.id },
    select: { favoriteSalon: { select: { slug: true, isActive: true } } },
  });
  return found?.favoriteSalon?.isActive ? `/s/${found.favoriteSalon.slug}` : "/";
}
