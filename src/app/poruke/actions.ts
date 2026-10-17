"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { findViewableSalon } from "@/lib/salonVisibility";
import { addMessage, messageSchema } from "@/lib/chat";
import { consume } from "@/lib/rateLimit";

/** A logged-in customer writes to a salon. */
export async function sendToSalon(slug: string, formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(`/poruke/${slug}`)}`);
  if (user.role !== "CLIENT") return;
  const parsed = messageSchema.safeParse({ text: String(formData.get("text") ?? "") });
  if (!parsed.success) return;
  // Chat spam: a customer can send at most 30 messages per 10 minutes, and 20 per hour into one salon.
  if (!(await consume([
    { key: `chat:user:${user.id}`, limit: 30, windowSec: 600 },
    { key: `chat:user-salon:${user.id}:${slug}`, limit: 20, windowSec: 3600 },
  ])).ok) return;
  try {
    const salon = await findViewableSalon(slug);
    if (!salon) return;
    await addMessage({ salonId: salon.id, clientId: user.id, senderId: user.id, fromSalon: false, text: parsed.data.text });
  } catch (error) {
    console.error(error);
  }
  revalidatePath(`/poruke/${slug}`);
}
