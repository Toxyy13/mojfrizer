import { z } from "zod";
import { db } from "./db";

export const MAX_MESSAGE_LENGTH = 1000;

export const messageSchema = z.object({
  text: z.string().trim().min(1, "Upišite poruku.").max(MAX_MESSAGE_LENGTH, "Poruka je preduga."),
});

export interface ChatLine {
  id: string;
  text: string;
  fromSalon: boolean;
  createdAt: Date;
}

/** Stores a message in the (salon, customer) conversation. salonId and clientId must already be verified. */
export async function addMessage(input: {
  salonId: string;
  clientId: string;
  senderId: string;
  fromSalon: boolean;
  text: string;
}): Promise<void> {
  await db.chatMessage.create({ data: input });
}

export async function loadConversation(salonId: string, clientId: string): Promise<ChatLine[]> {
  const rows = await db.chatMessage.findMany({
    where: { salonId, clientId },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { id: true, text: true, fromSalon: true, createdAt: true },
  });
  return rows;
}

/** Marks the other side's messages as read when someone opens the conversation. */
export async function markRead(salonId: string, clientId: string, readerIsSalon: boolean): Promise<void> {
  await db.chatMessage.updateMany({
    where: { salonId, clientId, fromSalon: !readerIsSalon, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function unreadForSalon(salonId: string): Promise<number> {
  return db.chatMessage.count({ where: { salonId, fromSalon: false, readAt: null } });
}
