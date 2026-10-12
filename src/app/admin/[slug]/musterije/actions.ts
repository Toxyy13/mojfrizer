"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSalonAccess } from "@/lib/access";
import { isValidClientKey } from "@/lib/clients";

/** Saves the salon's note about a customer and whether they may book online. */
export async function saveClientNote(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonAccess(slug);
  const clientKey = String(formData.get("clientKey") ?? "");
  if (!isValidClientKey(clientKey)) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const blockedOnline = formData.get("blockedOnline") === "on";
  try {
    await db.salonClientNote.upsert({
      where: { salonId_clientKey: { salonId: salon.id, clientKey } },
      create: { salonId: salon.id, clientKey, note, blockedOnline },
      update: { note, blockedOnline },
    });
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath(`/admin/${slug}`, "layout");
  redirect(`/admin/${slug}/musterije/${encodeURIComponent(clientKey)}?sacuvano=1`);
}
