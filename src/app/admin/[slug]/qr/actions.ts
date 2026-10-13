"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSalonOwner } from "@/lib/access";
import { newQrToken } from "@/lib/salonVisibility";

/** Replaces the QR link's secret: posters printed before this stop working. */
export async function regenerateQrToken(slug: string): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  await db.salon.update({ where: { id: salon.id }, data: { qrToken: newQrToken() } });
  revalidatePath(`/admin/${slug}/qr`);
  redirect(`/admin/${slug}/qr?nov=1`);
}
