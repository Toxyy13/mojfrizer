"use server";

import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, hashPassword, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeNextPath } from "@/lib/landing";
import { normalizePhone } from "@/lib/phone";
import type { FormState } from "../prijava/actions";

const MIN_PASSWORD_LENGTH = 8;

const emailSchema = z.string().trim().toLowerCase().email().max(120);

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const rawEmail = String(formData.get("email") ?? "");
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const values = { name, email: rawEmail, phone: rawPhone };

  const email = emailSchema.safeParse(rawEmail);
  // Phone is optional here; it only prefills the booking form.
  const phone = rawPhone ? normalizePhone(rawPhone) : null;

  if (name.length < 2 || name.length > 80) return { error: "Upišite ime i prezime.", values };
  if (!email.success) return { error: "Upišite ispravnu email adresu.", values };
  if (rawPhone && !phone) return { error: "Broj telefona nije ispravan, npr. 064 123 4567.", values };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Lozinka mora imati bar ${MIN_PASSWORD_LENGTH} znakova.`, values };
  }

  try {
    const user = await db.user.create({
      data: { name, email: email.data, phone, passwordHash: await hashPassword(password), role: Role.CLIENT },
      select: { id: true, email: true, name: true, role: true },
    });
    await startSession(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const what = String(error.meta?.target ?? "").includes("phone") ? "ovim brojem telefona" : "ovom email adresom";
      return { error: `Nalog sa ${what} već postoji. Prijavite se.`, values };
    }
    console.error(error);
    return { error: "Greška pri registraciji. Pokušajte ponovo.", values };
  }
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

/** Marks a salon as favorite, or clears the favorite when salonId is empty. */
export async function setFavoriteSalon(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(formData.get("returnTo")) ?? "/nalog";
  const user = await getSessionUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(returnTo)}`);

  const salonId = String(formData.get("salonId") ?? "");
  try {
    if (salonId) {
      const salon = await db.salon.findFirst({ where: { id: salonId, isActive: true }, select: { id: true } });
      if (!salon) return;
    }
    await db.user.update({ where: { id: user.id }, data: { favoriteSalonId: salonId || null } });
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath(returnTo);
}
