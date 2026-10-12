"use server";

import { revalidatePath } from "next/cache";
import { cancelByCustomer, rescheduleByCustomer, type ManageResult } from "@/lib/manageBooking";
import { submitReview } from "@/lib/reviews";
import { isValidDateIso } from "@/lib/time";

export async function cancelBooking(token: string): Promise<ManageResult> {
  try {
    const result = await cancelByCustomer(token);
    revalidatePath(`/termin/${token}`);
    return result;
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Otkazivanje nije uspelo. Pokušajte ponovo ili pozovite salon." };
  }
}

export async function rescheduleBooking(token: string, dateIso: string, minute: number): Promise<ManageResult> {
  if (!isValidDateIso(dateIso) || !Number.isInteger(minute) || minute < 0 || minute > 24 * 60) {
    return { ok: false, error: "Izaberite dan i vreme." };
  }
  try {
    const result = await rescheduleByCustomer(token, dateIso, minute);
    revalidatePath(`/termin/${token}`);
    return result;
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Pomeranje nije uspelo. Pokušajte ponovo ili pozovite salon." };
  }
}

export async function reviewVisit(token: string, formData: FormData): Promise<void> {
  try {
    const result = await submitReview(token, Number(formData.get("rating")), String(formData.get("comment") ?? ""));
    if (!result.ok) console.error(`review refused: ${result.error}`);
  } catch (error) {
    console.error(error);
  }
  revalidatePath(`/termin/${token}`);
}
