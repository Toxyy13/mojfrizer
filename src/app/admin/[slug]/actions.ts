"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalonAccess, requireSalonOwner } from "@/lib/access";
import { applyComboPricing } from "@/lib/comboPricing";
import { TIME_ZONE, formatLocalDateIso, isValidDateIso } from "@/lib/time";
import { notifyWaitlist } from "@/lib/waitlist";
import { moveBooking } from "@/lib/manageBooking";
import { salonBookingInputSchema, createAppointment, type BookingResult } from "@/lib/booking";
import { setUrgentRequestStatus, swapForUrgentRequest, swapSchema } from "@/lib/urgent";

export async function bookForClient(slug: string, raw: unknown): Promise<BookingResult> {
  const { salon, user, staffWorkerId } = await requireSalonAccess(slug);
  try {
    const parsed = salonBookingInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
    // A staff login can book only into their own schedule.
    const input = staffWorkerId ? { ...parsed.data, workerId: staffWorkerId } : parsed.data;
    const result = await createAppointment(salon.id, input, {
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
  const { salon, staffWorkerId } = await requireSalonAccess(slug);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as AppointmentStatus;
  if (!ALLOWED.includes(status)) return;
  const where = { id, salonId: salon.id, ...(staffWorkerId ? { workerId: staffWorkerId } : {}) };
  let overlap = false;
  try {
    // salonId in the filter keeps one tenant from touching another tenant's appointment.
    await db.$transaction(async (tx) => {
      const { count } = await tx.appointment.updateMany({
        where,
        data: { status },
      });
      // Cancelling or restoring a service can change combo prices in the same visit.
      if (count > 0) await applyComboPricing(tx, id);
    });
    if (status === "CANCELLED") {
      const cancelled = await db.appointment.findFirst({
        where,
        select: { startTime: true },
      });
      if (cancelled) await notifyWaitlist(salon.id, formatLocalDateIso(cancelled.startTime, TIME_ZONE));
    }
  } catch (error) {
    // Re-activating a cancelled slot that is now taken violates the overlap constraint.
    overlap = String(error).includes("appointments_no_overlap") || String(error).includes("23P01");
    if (!overlap) console.error(error);
  }
  revalidatePath(`/admin/${slug}`);
  // The owner is told why the appointment stayed cancelled instead of nothing happening.
  if (overlap) redirect(`/admin/${slug}?zauzeto=1`);
}

/** Moves a booked appointment to another free time. Staff move only their own; the owner any (and may change hairdresser if the old one is busy). */
export async function moveAppointment(slug: string, formData: FormData): Promise<void> {
  const { salon, staffWorkerId } = await requireSalonAccess(slug);
  const dateIso = String(formData.get("date") ?? "");
  const [h, m] = String(formData.get("time") ?? "").split(":").map(Number);
  const appointment = await db.appointment.findFirst({
    where: { id: String(formData.get("id") ?? ""), salonId: salon.id, status: "BOOKED", ...(staffWorkerId ? { workerId: staffWorkerId } : {}) },
    select: { id: true, salonId: true, workerId: true, startTime: true, endTime: true },
  });
  let error = "Termin nije pronađen.";
  if (appointment && isValidDateIso(dateIso) && Number.isInteger(h) && Number.isInteger(m)) {
    const result = await moveBooking(appointment, dateIso, h * 60 + m, { enforceLeadTime: false, onlyWorkerId: staffWorkerId });
    if (result.ok) {
      revalidatePath(`/admin/${slug}`);
      redirect(`/admin/${slug}?date=${dateIso}`);
    }
    error = result.error;
  }
  redirect(`/admin/${slug}?date=${formatLocalDateIso(appointment?.startTime ?? new Date(), TIME_ZONE)}&greska=${encodeURIComponent(error)}`);
}

export interface SwapState {
  error: string | null;
}

export async function swapForUrgent(slug: string, _prev: SwapState, formData: FormData): Promise<SwapState> {
  const { salon, user } = await requireSalonOwner(slug);
  const parsed = swapSchema.safeParse({
    requestId: formData.get("requestId"),
    appointmentId: formData.get("appointmentId"),
    newDateIso: formData.get("newDateIso"),
    newTime: formData.get("newTime"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Neispravni podaci" };
  try {
    const result = await swapForUrgentRequest(salon.id, user.id, parsed.data);
    if (!result.ok) return { error: result.error };
  } catch (error) {
    console.error(error);
    return { error: "Zamena nije uspela. Pokušajte ponovo." };
  }
  revalidatePath(`/admin/${slug}`);
  return { error: null };
}

const URGENT_STATUSES = ["RESOLVED", "DECLINED"] as const;

export async function closeUrgentRequest(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const status = String(formData.get("status") ?? "");
  const match = URGENT_STATUSES.find((s) => s === status);
  if (!match) return;
  try {
    await setUrgentRequestStatus(salon.id, String(formData.get("id") ?? ""), match);
  } catch (error) {
    console.error(error);
  }
  revalidatePath(`/admin/${slug}`);
}
