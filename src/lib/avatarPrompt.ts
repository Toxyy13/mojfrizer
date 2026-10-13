import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

export const AVATAR_PROMPT_COOKIE = "mf_foto_kasnije";
export const AVATAR_PROMPT_DAYS = 14;

/** Developers have no customer profile; everybody else is nudged once per snooze period. */
export function roleSeesAvatarPrompt(role: Role): boolean {
  return role !== "DEVELOPER";
}

/** True when the reminder should be shown: signed in, no photo yet and not snoozed. */
export async function shouldShowAvatarPrompt(role: Role, hasAvatar: boolean): Promise<boolean> {
  if (hasAvatar || !roleSeesAvatarPrompt(role)) return false;
  return !(await cookies()).has(AVATAR_PROMPT_COOKIE);
}
