"use server";

import { revalidatePath } from "next/cache";
import { cancelByCustomer, rescheduleByCustomer, type ManageResult } from "@/lib/manageBooking";
import { submitReview } from "@/lib/reviews";
import { isValidDateIso } from "@/lib/time";
import { consume, requestIp, TOO_MANY } from "@/lib/rateLimit";

// Booking links are unguessable secrets, but anyone holding one (or guessing) can still hammer these actions.
async function tooMany(): Promise<boolean> {
  return !(await consume([{ key: `manage:ip:${await requestIp()}`, limit: 40, windowSec: 600 }])).ok;
}

export async function cancelBooking(token: string): Promise<ManageResult> {
  if (await tooMany()) return { ok: false, error: TOO_MANY };
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
  if (await tooMany()) return { ok: false, error: TOO_MANY };
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
  if (await tooMany()) return;
  try {
    const result = await submitReview(token, Number(formData.get("rating")), String(formData.get("comment") ?? ""));
    if (!result.ok) console.error(`review refused: ${result.error}`);
  } catch (error) {
    console.error(error);
  }
  revalidatePath(`/termin/${token}`);
}
