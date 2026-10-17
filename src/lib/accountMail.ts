import { appUrl } from "./appUrl";
// Trusted internal code (tokens, mail, cron, login): runs with RLS bypass, see src/lib/rls.ts.
import { systemDb as db } from "./db";
import { issueToken } from "./emailTokens";
import { sendMail } from "./mail";

/** Mails the "confirm your email" link. Does nothing for verified accounts or without an email. */
export async function sendVerificationMail(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, emailVerifiedAt: true } });
  if (!user?.email || user.emailVerifiedAt) return false;
  const token = await issueToken(userId, "VERIFY_EMAIL");
  if (!token) return false;
  await sendMail({
    to: user.email,
    subject: "Potvrdite email adresu · mojfrizer",
    text: [
      `Zdravo ${user.name},`,
      "",
      "potvrdite email adresu klikom na link (važi 48 sati):",
      `${appUrl()}/potvrda-emaila?token=${token}`,
      "",
      "Tek posle potvrde šaljemo podsetnike za termine na ovu adresu.",
      "Ako niste pravili nalog na mojfrizer.com, ignorišite ovaj mejl.",
    ].join("\n"),
  });
  return true;
}

/** Mails the password reset link. Silent when there is no such account, so the form leaks nothing. */
export async function sendResetMail(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, name: true, email: true } });
  if (!user?.email) return;
  const token = await issueToken(user.id, "RESET_PASSWORD");
  if (!token) return;
  await sendMail({
    to: user.email,
    subject: "Nova lozinka · mojfrizer",
    text: [
      `Zdravo ${user.name},`,
      "",
      "da biste postavili novu lozinku, kliknite na link (važi 1 sat):",
      `${appUrl()}/nova-lozinka?token=${token}`,
      "",
      "Ako niste tražili novu lozinku, ignorišite ovaj mejl, vaša lozinka ostaje ista.",
    ].join("\n"),
  });
}

/** Tells the account owner that the login was locked after repeated wrong passwords. */
export async function sendLockoutMail(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, select: { name: true, email: true } });
  if (!user?.email) return;
  await sendMail({
    to: user.email,
    subject: "Prijava na nalog je privremeno zaključana · mojfrizer",
    text: [
      `Zdravo ${user.name},`,
      "",
      "neko je 5 puta uneo pogrešnu lozinku za vaš nalog, pa smo prijavu privremeno zaključali na 15 minuta.",
      "Ako ste to bili vi, sačekajte ili postavite novu lozinku:",
      `${appUrl()}/zaboravljena-lozinka`,
      "",
      "Ako niste, ne morate ništa da radite: vaša lozinka nije promenjena. Preporučujemo da je ipak promenite.",
    ].join("\n"),
  });
}

/** Tells the account owner that the password was changed (a stolen session would otherwise go unnoticed). */
export async function sendPasswordChangedMail(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (!user?.email) return;
  await sendMail({
    to: user.email,
    subject: "Lozinka je promenjena · mojfrizer",
    text: [
      `Zdravo ${user.name},`,
      "",
      "lozinka za vaš nalog na mojfrizer.com je upravo promenjena.",
      "Ako to niste vi, odmah postavite novu lozinku:",
      `${appUrl()}/zaboravljena-lozinka`,
    ].join("\n"),
  });
}
