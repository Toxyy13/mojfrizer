import { NextResponse } from "next/server";
import { loadManagedAppointment, toIcs } from "@/lib/manageBooking";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  const appointment = await loadManagedAppointment(token);
  if (!appointment) return new NextResponse("Termin nije pronađen", { status: 404 });
  return new NextResponse(toIcs(appointment), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="termin-${appointment.salon.slug}.ics"`,
    },
  });
}
