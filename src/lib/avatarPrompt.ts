import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

export const AVATAR_PROMPT_COOKIE = "mf_foto_kasnije";
export const AVATAR_PROMPT_DAYS = 14;

/** Only customer accounts are nudged; salon owners, workers and developers never are. */
export function roleSeesAvatarPrompt(role: Role): boolean {
  return role === "CLIENT";
}

/** True when the reminder should be shown: signed in, no photo yet and not snoozed. */
export async function shouldShowAvatarPrompt(role: Role, hasAvatar: boolean): Promise<boolean> {
  if (hasAvatar || !roleSeesAvatarPrompt(role)) return false;
  return !(await cookies()).has(AVATAR_PROMPT_COOKIE);
}
