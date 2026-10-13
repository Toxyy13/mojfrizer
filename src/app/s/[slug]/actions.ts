"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { findViewableSalon } from "@/lib/salonVisibility";
import { bookingInputSchema, createAppointment, type BookingResult } from "@/lib/booking";
import { isBlockedOnline } from "@/lib/clients";
import { sendBookingConfirmation } from "@/lib/manageBooking";
import { joinWaitlist, type WaitlistResult } from "@/lib/waitlist";
import { createUrgentRequest, urgentRequestSchema, type ActionResult } from "@/lib/urgent";
import { startUrgentChat, urgentChatSchema, type UrgentChatResult } from "@/lib/urgentChat";
import { MAX_SERVICES_PER_VISIT } from "@/lib/visit";

const waitlistServicesSchema = z.array(z.string().min(1)).min(1).max(MAX_SERVICES_PER_VISIT);

export async function bookOnline(slug: string, raw: unknown): Promise<BookingResult> {
  try {
    const parsed = bookingInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
    const salon = await findViewableSalon(slug);
    if (!salon) return { ok: false, error: "Salon nije pronađen." };
    // Guests can book with just name and phone; a logged-in customer gets the booking on their account.
    const user = await getSessionUser();
    const clientId = user?.role === "CLIENT" ? user.id : null;
    if (await isBlockedOnline(salon.id, { guestPhone: parsed.data.clientPhone, clientId })) {
      return { ok: false, error: "Za ovaj termin pozovite salon telefonom." };
    }
    const result = await createAppointment(salon.id, parsed.data, {
      source: "ONLINE",
      createdById: user?.id ?? null,
      clientId,
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
    const salon = await findViewableSalon(slug);
    if (!salon) return { ok: false, error: "Salon nije pronađen." };
    const user = await getSessionUser();
    return await createUrgentRequest(salon.id, parsed.data, user?.role === "CLIENT" ? user.id : null);
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo ili nas pozovite." };
  }
}

export async function joinSalonWaitlist(slug: string, serviceIds: unknown, dateIso: string): Promise<WaitlistResult> {
  try {
    const ids = waitlistServicesSchema.safeParse(serviceIds);
    if (!ids.success) return { ok: false, error: "Izaberite uslugu." };
    const user = await getSessionUser();
    if (!user) return { ok: false, error: "login" };
    const salon = await findViewableSalon(slug);
    if (!salon) return { ok: false, error: "Salon nije pronađen." };
    return await joinWaitlist(salon.id, user.id, ids.data, dateIso);
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo." };
  }
}

/** "Hitna rezervacija": opens (or reuses) the customer's chat with the salon; "login" means log in first. */
export async function startUrgentBooking(slug: string, raw: unknown): Promise<UrgentChatResult> {
  try {
    const parsed = urgentChatSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
    const user = await getSessionUser();
    if (!user) return { ok: false, error: "login" };
    if (user.role !== "CLIENT") return { ok: false, error: "Hitnu rezervaciju šalju mušterije sa svog naloga." };
    const salon = await findViewableSalon(slug);
    if (!salon) return { ok: false, error: "Salon nije pronađen." };
    const account = await db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, phone: true } });
    if (!account) return { ok: false, error: "login" };
    return await startUrgentChat(salon.id, account, parsed.data);
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo ili nas pozovite." };
  }
}
