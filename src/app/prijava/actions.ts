"use server";

import { redirect } from "next/navigation";
import { signOut, startSession, verifyCredentials } from "@/lib/auth";
import { landingPathFor, safeNextPath } from "@/lib/landing";

export interface FormState {
  error: string | null;
  /** Submitted non-secret values, so the form keeps them after an error. */
  values?: Record<string, string>;
}

/** Email (or, for older accounts, a phone number) plus password. */
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const loginValue = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const values = { login: loginValue };
  let target: string;
  try {
    const user = await verifyCredentials(loginValue, password);
    if (!user) return { error: "Pogrešna email adresa ili lozinka.", values };
    await startSession(user);
    target = safeNextPath(formData.get("next")) ?? (await landingPathFor(user));
  } catch (error) {
    console.error(error);
    return { error: "Greška pri prijavi. Pokušajte ponovo.", values };
  }
  redirect(target);
}

export async function logout(): Promise<void> {
  await signOut();
  redirect("/prijava");
}
