"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AVATAR_PROMPT_COOKIE, AVATAR_PROMPT_DAYS } from "@/lib/avatarPrompt";

/** "Kasnije": hide the photo reminder for a while. A functional cookie, nothing is tracked. */
export async function snoozeAvatarPrompt(): Promise<void> {
  (await cookies()).set(AVATAR_PROMPT_COOKIE, "1", {
    maxAge: AVATAR_PROMPT_DAYS * 86400,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/");
  revalidatePath("/nalog");
}
