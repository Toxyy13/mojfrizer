"use server";

import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPasswordChangedMail, sendResetMail, sendVerificationMail } from "@/lib/accountMail";
import bcrypt from "bcryptjs";
import { MAX_PASSWORD_LENGTH, getSessionUser, hashPassword, revokeSessions, startSession } from "@/lib/auth";
import { consumeToken } from "@/lib/emailTokens";
import { db, systemDb } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/company";
import { safeNextPath } from "@/lib/landing";
import { canViewSalon } from "@/lib/salonVisibility";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { clearLimit, consume, isBlocked, keyPart, recordHit, requestIp, waitMessage } from "@/lib/rateLimit";
import type { FormState } from "../prijava/actions";

const MIN_PASSWORD_LENGTH = 8;

const RESET_NOTICE = "Ako nalog sa tom adresom postoji, poslali smo vam link za novu lozinku.";

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

  // Bots fill every field they see; people never see this one.
  if (String(formData.get("mf_hp") ?? "") !== "") return { error: "Greška pri registraciji. Pokušajte ponovo.", values };
  const limited = await consume([
    { key: `register:ip:${await requestIp()}`, limit: 5, windowSec: 3600 },
    { key: "register:all", limit: 300, windowSec: 3600 },
  ]);
  if (!limited.ok) return { error: waitMessage(limited), values };

  if (name.length < 2 || name.length > 80) return { error: "Upišite ime i prezime.", values };
  if (!email.success) return { error: "Upišite ispravnu email adresu.", values };
  if (formData.get("terms") !== "on") return { error: "Potvrdite da imate najmanje 15 godina i da prihvatate uslove.", values };
  if (rawPhone && !phone) return { error: "Broj telefona nije ispravan, npr. 064 123 4567.", values };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Lozinka mora imati bar ${MIN_PASSWORD_LENGTH} znakova.`, values };
  }
  if (password.length > MAX_PASSWORD_LENGTH) return { error: `Lozinka može imati najviše ${MAX_PASSWORD_LENGTH} znakova.`, values };

  try {
    // Registration creates the account before anyone is logged in: system access (RLS).
    const user = await systemDb.user.create({
      data: { name, email: email.data, phone, passwordHash: await hashPassword(password), role: Role.CLIENT, termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
      select: { id: true, email: true, name: true, role: true },
    });
    await startSession(user);
    // A failing mail provider must not block registration; the account page can resend it.
    await sendVerificationMail(user.id).catch((mailError: unknown) => console.error(mailError));
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
      if (!salon || !(await canViewSalon(salon.id, user))) return;
    }
    await db.user.update({ where: { id: user.id }, data: { favoriteSalonId: salonId || null } });
  } catch (error) {
    console.error(error);
    return;
  }
  revalidatePath(returnTo);
}

export interface ProfileState extends FormState {
  saved?: boolean;
}

/** Name and phone: salon staff call this number if something comes up with an appointment. */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getSessionUser();
  if (!user) redirect("/prijava?next=/nalog/profil");
  const limited = await consume([{ key: `profile:user:${user.id}`, limit: 30, windowSec: 3600 }]);
  if (!limited.ok) return { error: waitMessage(limited) };
  const name = String(formData.get("name") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "");
  const values = { name, phone: rawPhone };
  // Phone is optional: an empty field removes it from the account.
  const phone = rawPhone.trim() ? normalizePhone(rawPhone) : null;
  if (name.length < 2 || name.length > 80) return { error: "Upišite ime i prezime.", values };
  if (rawPhone.trim() && !phone) return { error: "Upišite ispravan broj telefona, npr. 064 123 4567.", values };
  try {
    await db.user.update({ where: { id: user.id }, data: { name, phone } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ovaj broj telefona već koristi drugi nalog.", values };
    }
    console.error(error);
    return { error: "Čuvanje nije uspelo. Pokušajte ponovo.", values };
  }
  revalidatePath("/nalog", "layout");
  return { error: null, saved: true, values: { name, phone: phone ? formatPhone(phone) : "" } };
}

/** Always answers the same, so the form can't be used to find out which emails have accounts. */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!email.success) return { error: "Upišite ispravnu email adresu.", values: { email: String(formData.get("email") ?? "") } };
  if (String(formData.get("mf_hp") ?? "") !== "") return { error: null, notice: RESET_NOTICE };
  // Same answer whether or not the limit was hit or the account exists; only the mail is withheld.
  const limited = await consume([
    { key: `reset:ip:${await requestIp()}`, limit: 5, windowSec: 900 },
    { key: `reset:email:${keyPart(email.data)}`, limit: 3, windowSec: 3600 },
  ]);
  if (!limited.ok) return { error: null, notice: RESET_NOTICE };
  try {
    await sendResetMail(email.data);
  } catch (error) {
    console.error(error);
  }
  return { error: null, notice: RESET_NOTICE };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Lozinka mora imati bar ${MIN_PASSWORD_LENGTH} znakova.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) return { error: `Lozinka može imati najviše ${MAX_PASSWORD_LENGTH} znakova.` };
  const limited = await consume([{ key: `reset-use:ip:${await requestIp()}`, limit: 20, windowSec: 900 }]);
  if (!limited.ok) return { error: waitMessage(limited) };
  try {
    const used = await consumeToken(token, "RESET_PASSWORD");
    if (!used) return { error: "Link je istekao ili je već iskorišćen. Zatražite novi." };
    const passwordHash = await hashPassword(password);
    await systemDb.$transaction([
      // Following the link proves the owner reads this mailbox, so the email counts as verified too.
      systemDb.user.updateMany({ where: { id: used.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
      systemDb.user.update({ where: { id: used.userId }, data: { passwordHash } }),
      // Any other reset links still in flight are void now.
      systemDb.emailToken.updateMany({
        where: { userId: used.userId, kind: "RESET_PASSWORD", usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    // A stolen cookie must not survive the reset.
    await revokeSessions(used.userId);
    // A new password ends the wait caused by earlier wrong attempts on this login.
    const owner = await systemDb.user.findUnique({ where: { id: used.userId }, select: { email: true } });
    if (owner?.email) await clearLimit(`login:acct:${keyPart(owner.email)}`);
  } catch (error) {
    console.error(error);
    return { error: "Čuvanje nije uspelo. Pokušajte ponovo." };
  }
  redirect("/prijava?lozinka=nova");
}

/** "Pošalji ponovo" on the account page. */
export async function resendVerification(): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/prijava?next=/nalog");
  if (!(await consume([{ key: `verify:user:${user.id}`, limit: 5, windowSec: 3600 }])).ok) return;
  try {
    await sendVerificationMail(user.id);
  } catch (error) {
    console.error(error);
  }
  revalidatePath("/nalog");
}

const CHANGE_FAILURES = { limit: 5, windowSec: 900 };

/** "Promena lozinke" on the account: the current password is required, and wrong guesses wait like at login. */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/nalog/lozinka");
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const rule = { key: `pwchange:user:${session.id}`, ...CHANGE_FAILURES };
  try {
    const blocked = await isBlocked(rule);
    if (!blocked.ok) return { error: waitMessage(blocked) };
    const user = await systemDb.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
    if (!user?.passwordHash) return { error: "Ovaj nalog nema lozinku. Postavite je preko „Zaboravljena lozinka”." };
    if (!(await bcrypt.compare(current.slice(0, MAX_PASSWORD_LENGTH), user.passwordHash))) {
      await recordHit(rule);
      return { error: "Trenutna lozinka nije tačna." };
    }
    if (password.length < MIN_PASSWORD_LENGTH) return { error: `Lozinka mora imati bar ${MIN_PASSWORD_LENGTH} znakova.` };
    if (password.length > MAX_PASSWORD_LENGTH) return { error: `Lozinka može imati najviše ${MAX_PASSWORD_LENGTH} znakova.` };
    if (password === current) return { error: "Nova lozinka mora da se razlikuje od trenutne." };
    await systemDb.user.update({ where: { id: session.id }, data: { passwordHash: await hashPassword(password) } });
    // Reset links requested before the change must not work any more.
    await systemDb.emailToken.updateMany({ where: { userId: session.id, kind: "RESET_PASSWORD", usedAt: null }, data: { usedAt: new Date() } });
    await clearLimit(rule.key);
    // Every other device is logged out (a stolen cookie must not survive); this one gets a fresh session.
    await revokeSessions(session.id);
    await startSession(session);
    await sendPasswordChangedMail(session.id).catch((mailError: unknown) => console.error(mailError));
  } catch (error) {
    console.error(error);
    return { error: "Čuvanje nije uspelo. Pokušajte ponovo." };
  }
  return { error: null, notice: "Lozinka je promenjena." };
}
