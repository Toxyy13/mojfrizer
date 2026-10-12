import { db } from "./db";
import { issueToken } from "./emailTokens";
import { sendMail } from "./mail";

const baseUrl = (): string => process.env.APP_URL ?? "https://mojfrizer.com";

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
      `${baseUrl()}/potvrda-emaila?token=${token}`,
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
      `${baseUrl()}/nova-lozinka?token=${token}`,
      "",
      "Ako niste tražili novu lozinku, ignorišite ovaj mejl, vaša lozinka ostaje ista.",
    ].join("\n"),
  });
}
