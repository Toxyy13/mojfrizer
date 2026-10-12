"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { bookingInputSchema, createAppointment, type BookingResult } from "@/lib/booking";
import { sendBookingConfirmation } from "@/lib/manageBooking";
import { createUrgentRequest, urgentRequestSchema, type ActionResult } from "@/lib/urgent";

export async function bookOnline(slug: string, raw: unknown): Promise<BookingResult> {
  try {
    const parsed = bookingInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
    const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!salon) return { ok: false, error: "Salon nije pronađen." };
    // Guests can book with just name and phone; a logged-in customer gets the booking on their account.
    const user = await getSessionUser();
    const result = await createAppointment(salon.id, parsed.data, {
      source: "ONLINE",
      createdById: user?.id ?? null,
      clientId: user?.role === "CLIENT" ? user.id : null,
    });
    if (result.ok) await sendBookingConfirmation(result.appointmentId);
    return result;
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo ili nas pozovite." };
  }
}

export async function requestUrgent(slug: string, raw: unknown): Promise<ActionResult> {
  try {
    const parsed = urgentRequestSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
    const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!salon) return { ok: false, error: "Salon nije pronađen." };
    const user = await getSessionUser();
    return await createUrgentRequest(salon.id, parsed.data, user?.role === "CLIENT" ? user.id : null);
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo ili nas pozovite." };
  }
}
