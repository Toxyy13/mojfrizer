"use server";

import { revalidatePath } from "next/cache";
import { requireSalonOwner } from "@/lib/access";
import { addMessage, messageSchema } from "@/lib/chat";
import { db } from "@/lib/db";

/** Salon staff answer a customer. */
export async function sendToClient(slug: string, clientId: string, formData: FormData): Promise<void> {
  const { salon, user } = await requireSalonOwner(slug);
  const parsed = messageSchema.safeParse({ text: String(formData.get("text") ?? "") });
  if (!parsed.success) return;
  try {
    // Only answer customers who already wrote to this salon.
    const existing = await db.chatMessage.findFirst({ where: { salonId: salon.id, clientId }, select: { id: true } });
    if (!existing) return;
    await addMessage({ salonId: salon.id, clientId, senderId: user.id, fromSalon: true, text: parsed.data.text });
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath(`/admin/${slug}/poruke/${clientId}`);
}
