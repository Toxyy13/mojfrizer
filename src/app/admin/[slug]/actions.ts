"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalonAccess } from "@/lib/access";
import { applyComboPricing } from "@/lib/comboPricing";
import { bookingInputSchema, createAppointment, type BookingResult } from "@/lib/booking";

export async function bookForClient(slug: string, raw: unknown): Promise<BookingResult> {
  const { salon, user } = await requireSalonAccess(slug);
  try {
    const parsed = bookingInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
    const result = await createAppointment(salon.id, parsed.data, {
      source: "SALON",
      createdById: user.id,
      clientId: null,
    });
    revalidatePath(`/admin/${slug}`);
    return result;
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Došlo je do greške pri upisu termina." };
  }
}

const ALLOWED: readonly AppointmentStatus[] = ["BOOKED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function setAppointmentStatus(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonAccess(slug);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AppointmentStatus;
  if (!ALLOWED.includes(status)) return;
  try {
    // salonId in the filter keeps one tenant from touching another tenant's appointment.
    await db.$transaction(async (tx) => {
      const { count } = await tx.appointment.updateMany({ where: { id, salonId: salon.id }, data: { status } });
      // Cancelling or restoring a service can change combo prices in the same visit.
      if (count > 0) await applyComboPricing(tx, id);
    });
  } catch (error) {
    // Re-activating a cancelled slot that is now taken violates the overlap constraint.
    console.error(error);
  }
  revalidatePath(`/admin/${slug}`);
}
