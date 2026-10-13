import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAvailableSlots, type Slot } from "@/lib/booking";
import { hasSalonAccess } from "@/lib/access";

export interface SlotsResponse {
  slots: Slot[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse<SlotsResponse | { error: string }>> {
  try {
    const { slug } = await params;
    const search = request.nextUrl.searchParams;
    const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!salon) return NextResponse.json({ error: "Salon nije pronađen" }, { status: 404 });

    // Salon staff may book without the online lead time (e.g. a walk-in right now).
    const staffMode = search.get("scope") === "salon" && (await hasSalonAccess(salon.id));
    const common = {
      salonId: salon.id,
      dateIso: search.get("date") ?? "",
      workerId: search.get("workerId") || null,
      enforceLeadTime: !staffMode,
    };
    // Moving an existing booking ("token" from the manage link) keeps that booking's length.
    const token = search.get("token");
    if (token) {
      const appointment = await db.appointment.findFirst({
        where: { manageToken: token, salonId: salon.id },
        select: { startTime: true, endTime: true },
      });
      if (!appointment) return NextResponse.json({ error: "Termin nije pronađen" }, { status: 404 });
      const durationMinutes = Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60_000);
      return NextResponse.json({ slots: await getAvailableSlots({ ...common, durationMinutes }) });
    }
    // "serviceIds" is a comma-separated list; "serviceId" is kept for older links.
    const serviceIds = (search.get("serviceIds") ?? search.get("serviceId") ?? "").split(",").filter(Boolean);
    const slots = await getAvailableSlots({ ...common, serviceIds });
    return NextResponse.json({ slots });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Greška pri učitavanju termina" }, { status: 500 });
  }
}
