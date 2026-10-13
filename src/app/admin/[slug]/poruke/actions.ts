"use server";

import { revalidatePath } from "next/cache";
import { requireSalonAccess } from "@/lib/access";
import { urgentClientIdsForStaff } from "@/lib/urgentChat";
import { addMessage, messageSchema } from "@/lib/chat";
import { db } from "@/lib/db";

/** Salon staff answer a customer. */
export async function sendToClient(slug: string, clientId: string, formData: FormData): Promise<void> {
  const { salon, user, staffWorkerId } = await requireSalonAccess(slug);
  const parsed = messageSchema.safeParse({ text: String(formData.get("text") ?? "") });
  if (!parsed.success) return;
  try {
    if (staffWorkerId && !(await urgentClientIdsForStaff(salon.id, staffWorkerId)).includes(clientId)) return;
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
