"use server";

import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { redirect } from "next/navigation";
import { sendVerificationMail } from "@/lib/accountMail";
import { getSessionUser, hashPassword, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { createSalon } from "@/lib/salonOnboarding";
import type { FormState } from "../prijava/actions";

const salonSchema = z.object({
  salonName: z.string().trim().min(2, "Upišite naziv salona.").max(80),
  city: z.string().trim().min(2, "Upišite grad.").max(60),
  address: z.string().trim().min(3, "Upišite adresu salona.").max(120),
});

const ownerSchema = z.object({
  name: z.string().trim().min(2, "Upišite ime i prezime.").max(80),
  email: z.string().trim().toLowerCase().email("Upišite ispravnu email adresu.").max(120),
  password: z.string().min(8, "Lozinka mora imati bar 8 znakova.").max(200),
});

export async function registerSalon(_prev: FormState, formData: FormData): Promise<FormState> {
  const read = (key: string): string => String(formData.get(key) ?? "");
  const values = {
    salonName: read("salonName"),
    city: read("city"),
    address: read("address"),
    phone: read("phone"),
    name: read("name"),
    email: read("email"),
  };
  const salon = salonSchema.safeParse(values);
  if (!salon.success) return { error: salon.error.issues[0]?.message ?? "Neispravni podaci", values };
  const rawPhone = values.phone.trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "Broj telefona nije ispravan, npr. 018 123 456.", values };

  let session = await getSessionUser();
  let slug: string;
  try {
    if (!session) {
      const owner = ownerSchema.safeParse({ ...values, password: read("password") });
      if (!owner.success) return { error: owner.error.issues[0]?.message ?? "Neispravni podaci", values };
      const user = await db.user.create({
        data: {
          name: owner.data.name,
          email: owner.data.email,
          passwordHash: await hashPassword(owner.data.password),
          role: Role.ADMIN,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      session = user;
      await sendVerificationMail(user.id).catch((mailError: unknown) => console.error(mailError));
    }
    slug = await createSalon({
      ownerId: session.id,
      ownerName: session.name,
      name: salon.data.salonName,
      city: salon.data.city,
      address: salon.data.address,
      phone: phone ? formatPhone(phone) : null,
    });
    // Refresh the session so a former customer account now carries the admin role.
    await startSession({ ...session, role: session.role === Role.CLIENT ? Role.ADMIN : session.role });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Nalog sa ovom email adresom već postoji. Prijavite se, pa otvorite salon.", values };
    }
    console.error(error);
    return { error: "Otvaranje salona nije uspelo. Pokušajte ponovo.", values };
  }
  redirect(`/admin/${slug}/podesavanja?ok=${encodeURIComponent("Salon je otvoren. Unesite cenovnik i proverite radno vreme.")}#usluge`);
}
