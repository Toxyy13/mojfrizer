"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signIn, signOut, type SignInResult } from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  let result: SignInResult | null = null;
  let target = "/";
  try {
    result = await signIn(email, password);
    if (result) target = await landingPath(result);
  } catch (error) {
    console.error(error);
    return { error: "Greška pri prijavi. Pokušajte ponovo." };
  }
  if (!result) return { error: "Pogrešan email ili lozinka." };
  redirect(target);
}

// Salon staff land in the admin panel; customers land on their favorite salon.
async function landingPath(result: SignInResult): Promise<string> {
  if (result.role !== "CLIENT") return "/admin";
  if (!result.favoriteSalonId) return "/";
  const salon = await db.salon.findUnique({ where: { id: result.favoriteSalonId }, select: { slug: true } });
  return salon ? `/s/${salon.slug}` : "/";
}

export async function logout(): Promise<void> {
  await signOut();
  redirect("/prijava");
}
