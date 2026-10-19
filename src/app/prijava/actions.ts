"use server";

import { redirect } from "next/navigation";
import { signOut, startSession, verifyCredentials } from "@/lib/auth";
import { sendLockoutMail } from "@/lib/accountMail";
import { looksLikeEmail } from "@/lib/phone";
import { headers } from "next/headers";
import { systemDb } from "@/lib/db";
import { assessLogin, captchaEnabled, captchaPassed, isKnownDevice, rememberDevice } from "@/lib/loginRisk";
import { landingPathFor, safeNextPath } from "@/lib/landing";
import { clearLimit, consume, hitCount, isBlocked, keyPart, recordHit, requestIp, waitMessage, type Rule } from "@/lib/rateLimit";

// Brute force protection: every attempt counts against the caller's address; failures also count against the
// account (from anywhere) and against the account from this address, and block further tries for a while.
const IP_ATTEMPTS = { limit: 30, windowSec: 600 };
const ACCOUNT_FAILURES = { limit: 5, windowSec: 900 };
const ACCOUNT_IP_FAILURES = { limit: 5, windowSec: 900 };
const IP_FAILURES = { limit: Number.MAX_SAFE_INTEGER, windowSec: 600 };
const REFUSED = "Prijava je odbijena zbog sumnjive aktivnosti. Pokušajte ponovo kasnije ili kontaktirajte podršku.";
const lockedMessage = (minutes: number): string => `Uneli ste pogrešnu lozinku previše puta. Pokušajte ponovo za ${minutes} min ili promenite lozinku preko „Zaboravljena lozinka”.`;
/** From this many wrong passwords on, the form says how many tries are left before the wait. */
const WARN_FROM_FAILURES = 3;

export interface FormState {
  error: string | null;
  /** Neutral confirmation shown under the form (e.g. "mail sent"). */
  notice?: string;
  /** Submitted non-secret values, so the form keeps them after an error. */
  values?: Record<string, string>;
  /** Login is locked until this moment (epoch ms): the form disables itself and counts down. */
  lockedUntil?: number;
  /** The form must show the captcha before the next try. */
  captcha?: boolean;
  /** The password was right but the email is not confirmed yet: the form offers to send the mail again. */
  unverified?: boolean;
}

function lockedState(retryAfterSec: number, values: Record<string, string>): FormState {
  const seconds = Math.max(1, retryAfterSec);
  return { error: lockedMessage(Math.max(1, Math.ceil(seconds / 60))), values, lockedUntil: Date.now() + seconds * 1000 };
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
      if (!blocked.ok) return lockedState(blocked.retryAfterSec, values);
    }
    const ipFailRule: Rule = { key: `login:ipfail:${ip}`, ...IP_FAILURES };
    const known = await isKnownDevice(account);
    const role = looksLikeEmail(loginValue) ? (await systemDb.user.findUnique({ where: { email: loginValue.trim().toLowerCase() }, select: { role: true } }))?.role : undefined;
    const { risk, reasons } = assessLogin({
      userAgent: (await headers()).get("user-agent") ?? "",
      knownDevice: known,
      accountFailures: await hitCount(failRules[0]),
      ipFailures: await hitCount(ipFailRule),
      developer: role === "DEVELOPER",
    });
    if (risk !== "no_risk") console.warn(`login ${risk}`, { account, ip, reasons });
    if (risk === "dangerous") return { error: REFUSED, values };
    if (risk === "risky" && captchaEnabled() && !(await captchaPassed(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
      return { error: "Potvrdite da niste robot, pa pokušajte ponovo.", values, captcha: true };
    }
    const user = await verifyCredentials(loginValue, password);
    if (!user) {
      for (const rule of [...failRules, ipFailRule]) await recordHit(rule);
      // The fifth wrong password starts the wait: tell the owner of the account once.
      if (looksLikeEmail(loginValue) && !(await isBlocked(failRules[0])).ok) {
        await sendLockoutMail(loginValue.trim()).catch((mailError: unknown) => console.error(mailError));
      }
      const failures = Math.max(...(await Promise.all(failRules.map(hitCount))));
      if (failures >= ACCOUNT_FAILURES.limit) return lockedState((await isBlocked(failRules[0])).retryAfterSec || ACCOUNT_FAILURES.windowSec, values);
      const left = ACCOUNT_FAILURES.limit - failures;
      const warning =
        failures >= WARN_FROM_FAILURES
          ? ` Još ${left === 1 ? "1 pokušaj" : `${left} pokušaja`}: posle toga morate da sačekate ${Math.round(ACCOUNT_FAILURES.windowSec / 60)} minuta pre sledeće prijave.`
          : "";
      return { error: `Pogrešna email adresa ili lozinka.${warning}`, values };
    }
    await clearLimit(...failRules.map((rule) => rule.key));
    // Only the right password gets this far, so saying "not confirmed" reveals nothing to a stranger.
    const owner = await systemDb.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true } });
    if (owner?.email && !owner.emailVerifiedAt) {
      return { error: "Email adresa još nije potvrđena. Kliknite na link u mejlu koji smo vam poslali.", values, unverified: true };
    }
    await startSession(user, formData.get("remember") === "on");
    await rememberDevice(account);
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
