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
    const slots = await getAvailableSlots({
      salonId: salon.id,
      serviceId: search.get("serviceId") ?? "",
      dateIso: search.get("date") ?? "",
      workerId: search.get("workerId") || null,
      enforceLeadTime: !staffMode,
    });
    return NextResponse.json({ slots });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Greška pri učitavanju termina" }, { status: 500 });
  }
}
