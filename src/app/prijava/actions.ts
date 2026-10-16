"use server";

import { redirect } from "next/navigation";
import { signOut, startSession, verifyCredentials } from "@/lib/auth";
import { sendLockoutMail } from "@/lib/accountMail";
import { looksLikeEmail } from "@/lib/phone";
import { landingPathFor, safeNextPath } from "@/lib/landing";
import { clearLimit, consume, isBlocked, keyPart, recordHit, requestIp, waitMessage, type Rule } from "@/lib/rateLimit";

// Brute force protection: every attempt counts against the caller's address; failures also count against the
// account (from anywhere) and against the account from this address, and block further tries for a while.
const IP_ATTEMPTS = { limit: 30, windowSec: 600 };
const ACCOUNT_FAILURES = { limit: 5, windowSec: 900 };
const ACCOUNT_IP_FAILURES = { limit: 5, windowSec: 900 };
const lockedMessage = (minutes: number): string => `Uneli ste pogrešnu lozinku previše puta. Pokušajte ponovo za ${minutes} min ili promenite lozinku preko „Zaboravljena lozinka”.`;

export interface FormState {
  error: string | null;
  /** Neutral confirmation shown under the form (e.g. "mail sent"). */
  notice?: string;
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
    if (String(formData.get("mf_hp") ?? "") !== "") return { error: "Pogrešna email adresa ili lozinka.", values };
    const ip = await requestIp();
    const account = keyPart(loginValue);
    const failRules: Rule[] = [
      { key: `login:acct:${account}`, ...ACCOUNT_FAILURES },
      { key: `login:acct-ip:${account}:${ip}`, ...ACCOUNT_IP_FAILURES },
    ];
    const attempts = await consume([{ key: `login:ip:${ip}`, ...IP_ATTEMPTS }]);
    if (!attempts.ok) return { error: waitMessage(attempts), values };
    for (const rule of failRules) {
      const blocked = await isBlocked(rule);
      if (!blocked.ok) return { error: lockedMessage(Math.max(1, Math.ceil(blocked.retryAfterSec / 60))), values };
    }
    const user = await verifyCredentials(loginValue, password);
    if (!user) {
      for (const rule of failRules) await recordHit(rule);
      // The fifth wrong password starts the wait: tell the owner of the account once.
      if (looksLikeEmail(loginValue) && !(await isBlocked(failRules[0])).ok) {
        await sendLockoutMail(loginValue.trim()).catch((mailError: unknown) => console.error(mailError));
      }
      return { error: "Pogrešna email adresa ili lozinka.", values };
    }
    await clearLimit(...failRules.map((rule) => rule.key));
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
