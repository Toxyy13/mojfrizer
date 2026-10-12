"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, hashPassword, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeNextPath } from "@/lib/landing";
import { normalizePhone } from "@/lib/phone";
import type { FormState } from "../prijava/actions";

const MIN_PASSWORD_LENGTH = 8;

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "");
  const phone = normalizePhone(rawPhone);
  const password = String(formData.get("password") ?? "");
  const values = { name, phone: rawPhone };

  if (name.length < 2 || name.length > 80) return { error: "Upišite ime i prezime.", values };
  if (!phone) return { error: "Upišite ispravan broj telefona, npr. 064 123 4567.", values };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Lozinka mora imati bar ${MIN_PASSWORD_LENGTH} znakova.`, values };
  }

  try {
    const user = await db.user.create({
      data: { name, phone, passwordHash: await hashPassword(password), role: Role.CLIENT },
      select: { id: true, email: true, name: true, role: true },
    });
    await startSession(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Nalog sa ovim brojem telefona već postoji. Prijavite se.", values };
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
