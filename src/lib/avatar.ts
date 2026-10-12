import { db } from "./db";

export const MAX_AVATAR_BYTES = 1_000_000;

/** Detects the image type from its first bytes; the browser-provided type is not trusted. */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

/**
 * A profile photo is visible to its owner and to staff of a salon the customer has dealt with
 * (an appointment, an urgent request or a chat). Nobody else.
 */
export async function canViewAvatar(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const count = await db.salon.count({
    where: {
      OR: [{ ownerId: viewerId }, { workers: { some: { userId: viewerId, isActive: true } } }],
      AND: {
        OR: [
          { appointments: { some: { clientId: ownerId } } },
          { urgentRequests: { some: { clientId: ownerId } } },
          { chatMessages: { some: { clientId: ownerId } } },
        ],
      },
    },
  });
  return count > 0;
}

/** URL for <img>, with a version so a new photo isn't served from the browser cache. */
export function avatarUrl(userId: string, avatar: { updatedAt: Date } | null | undefined): string | null {
  return avatar ? `/api/avatar/${userId}?v=${avatar.updatedAt.getTime()}` : null;
}
