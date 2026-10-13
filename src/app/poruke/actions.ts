"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { findViewableSalon } from "@/lib/salonVisibility";
import { addMessage, messageSchema } from "@/lib/chat";
import { db } from "@/lib/db";

/** A logged-in customer writes to a salon. */
export async function sendToSalon(slug: string, formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(`/poruke/${slug}`)}`);
  if (user.role !== "CLIENT") return;
  const parsed = messageSchema.safeParse({ text: String(formData.get("text") ?? "") });
  if (!parsed.success) return;
  try {
    const salon = await findViewableSalon(slug);
    if (!salon) return;
    await addMessage({ salonId: salon.id, clientId: user.id, senderId: user.id, fromSalon: false, text: parsed.data.text });
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath(`/poruke/${slug}`);
}
