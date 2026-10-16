import { NextResponse, type NextRequest } from "next/server";
import { apiError, type ApiErrorBody } from "@/lib/apiError";
import { systemDb } from "@/lib/db";
import { getAvailableSlots, type Slot } from "@/lib/booking";
import { hasSalonAccess } from "@/lib/access";
import { findViewableSalon } from "@/lib/salonVisibility";
import { isValidDateIso } from "@/lib/time";

// Free slots change with every booking and depend on who asks (private salons, staff mode, a booking being moved),
// so no browser, proxy or CDN may keep an answer.
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export interface SlotsResponse {
  slots: Slot[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse<SlotsResponse | ApiErrorBody>> {
  try {
    const { slug } = await params;
    const search = request.nextUrl.searchParams;
    const salon = await findViewableSalon(slug);
    if (!salon) return apiError(404, "Salon nije pronađen.", NO_STORE);

    // Salon staff may book without the online lead time (e.g. a walk-in right now).
    const dateIso = search.get("date") ?? "";
    if (!isValidDateIso(dateIso)) return apiError(400, "Neispravan datum.", NO_STORE);
    const staffMode = search.get("scope") === "salon" && (await hasSalonAccess(salon.id));
    const common = {
      salonId: salon.id,
      dateIso,
      workerId: search.get("workerId") || null,
      enforceLeadTime: !staffMode,
    };
    // Moving an existing booking ("token" from the manage link) keeps that booking's length.
    const token = search.get("token");
    if (token) {
      // The secret booking token is the credential here, and a visitor may not read bookings otherwise: system access (RLS).
      const appointment = await systemDb.appointment.findFirst({
        where: { manageToken: token, salonId: salon.id },
        select: { startTime: true, endTime: true },
      });
      if (!appointment) return apiError(404, "Termin nije pronađen.", NO_STORE);
      const durationMinutes = Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60_000);
      return NextResponse.json({ slots: await getAvailableSlots({ ...common, durationMinutes }) }, { headers: NO_STORE });
    }
    // "serviceIds" is a comma-separated list; "serviceId" is kept for older links.
    const serviceIds = (search.get("serviceIds") ?? search.get("serviceId") ?? "").split(",").filter(Boolean);
    const slots = await getAvailableSlots({ ...common, serviceIds });
    return NextResponse.json({ slots }, { headers: NO_STORE });
  } catch (error) {
    console.error(error);
    return apiError(500, "Greška pri učitavanju termina.", NO_STORE);
  }
}
