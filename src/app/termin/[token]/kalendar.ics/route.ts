import { NextResponse } from "next/server";
import { loadManagedAppointment, toIcs } from "@/lib/manageBooking";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  const appointment = await loadManagedAppointment(token);
  if (!appointment) return new NextResponse("Termin nije pronađen", { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = toIcs(appointment);
  return new NextResponse(body, {
    headers: {
      "Content-Length": String(Buffer.byteLength(body)),
      // The link is a secret (it manages the booking): never kept by shared caches. Moved or cancelled bookings
      // must show up at once, so browsers revalidate too.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="termin-${appointment.salon.slug}.ics"`,
    },
  });
}
