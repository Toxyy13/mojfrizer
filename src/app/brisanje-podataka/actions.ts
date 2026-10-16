"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAccount } from "@/lib/accountDeletion";
import bcrypt from "bcryptjs";
import { MAX_PASSWORD_LENGTH, getSessionUser, signOut } from "@/lib/auth";
import { isBlocked, recordHit, waitMessage } from "@/lib/rateLimit";
import { db, systemDb } from "@/lib/db";
import type { FormState } from "../prijava/actions";

const CONFIRM_WORD = "OBRIŠI";

/** Deletes the signed-in account after the person types the confirmation word. */
export async function deleteMyAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/brisanje-podataka");
  const typed = String(formData.get("confirm") ?? "").trim().toLocaleUpperCase("sr-Latn");
  if (typed !== CONFIRM_WORD) return { error: `Upišite reč ${CONFIRM_WORD} da potvrdite brisanje.` };
  try {
    // Someone at an unlocked phone must not be able to erase the account: accounts with a password ask for it.
    const owner = await systemDb.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
    if (owner?.passwordHash) {
      const rule = { key: `delete:user:${session.id}`, limit: 5, windowSec: 900 };
      const blocked = await isBlocked(rule);
      if (!blocked.ok) return { error: waitMessage(blocked) };
      const password = String(formData.get("password") ?? "").slice(0, MAX_PASSWORD_LENGTH);
      if (!(await bcrypt.compare(password, owner.passwordHash))) {
        await recordHit(rule);
        return { error: "Lozinka nije tačna." };
      }
    }
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
