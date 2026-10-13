import { NextResponse, type NextRequest } from "next/server";
import { systemDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { appUrl } from "@/lib/appUrl";
import { connectCustomerToSalon } from "@/lib/salonVisibility";

/**
 * Target of the QR poster. A customer who is logged in gets connected to the salon (so a private salon opens
 * for them) and it becomes their favorite; everyone else registers or logs in first and comes back here.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  const origin = appUrl(request.nextUrl.origin);
  // The token is a secret in the URL: keep it out of Referer headers and caches.
  const send = (path: string): NextResponse => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  try {
    const salon = token.length >= 32 ? await systemDb.salon.findFirst({ where: { qrToken: token, isActive: true }, select: { id: true, slug: true } }) : null;
    if (!salon) return new NextResponse("Salon nije pronađen.", { status: 404, headers: { "Cache-Control": "no-store" } });
    const user = await getSessionUser();
    if (!user) return send(`/registracija?next=${encodeURIComponent(`/q/${token}`)}`);
    // Staff and the developer can already open the salon; only customers get connected.
    if (user.role === "CLIENT") await connectCustomerToSalon(user.id, salon.id);
    return send(`/s/${salon.slug}`);
  } catch (error) {
    console.error(error);
    return new NextResponse("Došlo je do greške. Pokušajte ponovo.", { status: 500 });
  }
}
