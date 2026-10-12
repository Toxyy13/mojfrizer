"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, hashPassword, signOut, startSession, verifyCredentials } from "@/lib/auth";
import { db } from "@/lib/db";
import { landingPathFor, safeNextPath } from "@/lib/landing";
import { normalizePhone } from "@/lib/phone";

export interface FormState {
  error: string | null;
  /** Submitted non-secret values, so the form keeps them after an error. */
  values?: Record<string, string>;
}

const MIN_PASSWORD_LENGTH = 8;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const loginValue = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const values = { login: loginValue };
  let userId: string;
  try {
    const user = await verifyCredentials(loginValue, password);
    if (!user) return { error: "Pogrešan broj telefona ili lozinka.", values };
    await startSession(user);
    userId = user.id;
  } catch (error) {
    console.error(error);
    return { error: "Greška pri prijavi. Pokušajte ponovo.", values };
  }
  redirect(safeNextPath(formData.get("next")) ?? (await landingPathFor(userId)));
}

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
      select: { id: true, email: true, name: true },
    });
    await startSession(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Nalog sa ovim brojem telefona već postoji. Prijavite se.", values };
    }
    console.error(error);
    return { error: "Greška pri registraciji. Pokušajte ponovo.", values };
  }
  redirect(safeNextPath(formData.get("next")) ?? "/search");
}

export async function logout(): Promise<void> {
  await signOut();
  redirect("/");
}

/** Marks a salon as favorite, or clears the favorite when salonId is empty. */
export async function setFavoriteSalon(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(formData.get("returnTo")) ?? "/account";
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  const salonId = String(formData.get("salonId") ?? "");
  if (salonId) {
    const salon = await db.salon.findFirst({ where: { id: salonId, isActive: true }, select: { id: true } });
    if (!salon) return;
  }
  try {
    await db.user.update({ where: { id: user.id }, data: { favoriteSalonId: salonId || null } });
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath(returnTo);
}
