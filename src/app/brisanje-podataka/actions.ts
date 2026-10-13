"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAccount } from "@/lib/accountDeletion";
import { getSessionUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "../prijava/actions";

const CONFIRM_WORD = "OBRIŠI";

/** Deletes the signed-in account after the person types the confirmation word. */
export async function deleteMyAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/brisanje-podataka");
  const typed = String(formData.get("confirm") ?? "").trim().toLocaleUpperCase("sr-Latn");
  if (typed !== CONFIRM_WORD) return { error: `Upišite reč ${CONFIRM_WORD} da potvrdite brisanje.` };
  try {
    const result = await deleteAccount(session.id);
    if (!result.ok) return { error: result.error };
  } catch (error) {
    console.error(error);
    return { error: "Brisanje nije uspelo. Pokušajte ponovo ili nam pišite." };
  }
  await signOut();
  redirect("/?nalog=obrisan");
}

export async function setEmailOptOut(formData: FormData): Promise<void> {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/brisanje-podataka");
  await db.user.update({ where: { id: session.id }, data: { emailOptOut: formData.get("optOut") === "1" } });
  revalidatePath("/brisanje-podataka");
}
