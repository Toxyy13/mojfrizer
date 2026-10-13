"use server";

import { randomBytes } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { sendResetMail, sendVerificationMail } from "@/lib/accountMail";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireDeveloper } from "@/lib/developer";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { createSalon } from "@/lib/salonOnboarding";

export interface CreateSalonState {
  error: string | null;
  values?: Record<string, string>;
  created?: { name: string; slug: string; ownerEmail: string; tempPassword: string | null };
}

const schema = z.object({
  salonName: z.string().trim().min(2, "Upišite naziv salona.").max(80),
  city: z.string().trim().min(2, "Upišite grad.").max(60),
  address: z.string().trim().min(3, "Upišite adresu salona.").max(120),
  ownerName: z.string().trim().min(2, "Upišite ime vlasnika.").max(80),
  ownerEmail: z.string().trim().toLowerCase().email("Upišite ispravnu email adresu vlasnika.").max(120),
  password: z.string().max(200),
});

/** Only the developer creates salons: the owner account, the salon and a temporary password in one step. */
export async function createSalonAccount(_prev: CreateSalonState, formData: FormData): Promise<CreateSalonState> {
  await requireDeveloper();
  const read = (key: string): string => String(formData.get(key) ?? "");
  const values = {
    salonName: read("salonName"),
    city: read("city"),
    address: read("address"),
    phone: read("phone"),
    ownerName: read("ownerName"),
    ownerEmail: read("ownerEmail"),
  };
  const parsed = schema.safeParse({ ...values, password: read("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Neispravni podaci", values };
  const rawPhone = values.phone.trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "Broj telefona nije ispravan, npr. 018 123 456.", values };
  if (parsed.data.password && parsed.data.password.length < 8) return { error: "Lozinka mora imati bar 8 znakova.", values };

  try {
    const existing = await db.user.findUnique({ where: { email: parsed.data.ownerEmail }, select: { id: true, name: true, role: true } });
    if (existing?.role === Role.DEVELOPER) return { error: "Ova adresa pripada nalogu platforme.", values };
    let ownerId: string;
    let ownerName: string;
    let tempPassword: string | null = null;
    if (existing) {
      ownerId = existing.id;
      ownerName = existing.name;
    } else {
      tempPassword = parsed.data.password || randomBytes(9).toString("base64url");
      const owner = await db.user.create({
        data: { name: parsed.data.ownerName, email: parsed.data.ownerEmail, passwordHash: await hashPassword(tempPassword), role: Role.ADMIN },
        select: { id: true, name: true },
      });
      ownerId = owner.id;
      ownerName = owner.name;
      await sendVerificationMail(owner.id).catch((mailError: unknown) => console.error(mailError));
    }
    const slug = await createSalon({
      ownerId,
      ownerName,
      name: parsed.data.salonName,
      city: parsed.data.city,
      address: parsed.data.address,
      phone: phone ? formatPhone(phone) : null,
    });
    revalidatePath("/razvoj");
    return { error: null, created: { name: parsed.data.salonName, slug, ownerEmail: parsed.data.ownerEmail, tempPassword } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Nalog sa ovom email adresom već postoji. Pokušajte ponovo.", values };
    }
    console.error(error);
    return { error: "Pravljenje salona nije uspelo. Pokušajte ponovo.", values };
  }
}

/** Suspends or reactivates a salon: a suspended salon vanishes from the site and its staff cannot sign in to it. */
export async function setSalonActive(formData: FormData): Promise<void> {
  await requireDeveloper();
  const id = String(formData.get("salonId") ?? "");
  const active = formData.get("active") === "true";
  const salon = await db.salon.update({ where: { id }, data: { isActive: active }, select: { slug: true } });
  revalidatePath("/razvoj");
  redirect(`/razvoj/saloni/${salon.slug}?ok=${encodeURIComponent(active ? "Salon je ponovo uključen." : "Salon je isključen.")}`);
}

/** Mails the owner a link to set a new password (valid 1 hour). */
export async function sendOwnerResetLink(formData: FormData): Promise<void> {
  await requireDeveloper();
  const id = String(formData.get("salonId") ?? "");
  const salon = await db.salon.findUnique({ where: { id }, select: { slug: true, owner: { select: { email: true } } } });
  if (!salon) redirect("/razvoj");
  if (salon.owner.email) await sendResetMail(salon.owner.email);
  redirect(`/razvoj/saloni/${salon.slug}?ok=${encodeURIComponent("Link za novu lozinku je poslat vlasniku.")}`);
}

/** Sends one harmless test error so the developer can check that Sentry receives events (/razvoj → Praćenje grešaka). */
export async function sendSentryTestError(): Promise<void> {
  await requireDeveloper();
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(new Error("mojfrizer: probna greška iz /razvoj"));
  await Sentry.flush(2000);
  redirect("/razvoj?sentry=poslato");
}
