import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth";
import { appUrl } from "@/lib/appUrl";
import { db } from "@/lib/db";
import { qrVersion } from "@/lib/qrVersion";

export const dynamic = "force-dynamic";

/**
 * QR poster image (PNG or SVG) of one salon, generated on request instead of being embedded in the page as a data URL.
 * Only the salon owner gets it. The URL carries a fingerprint of the token (?v=), so a browser may keep the image
 * for a year and a renewed token automatically gets a new URL.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const { slug } = await params;
  const user = await getSessionUser();
  const salon = user
    ? await db.salon.findFirst({ where: { slug, isActive: true, ownerId: user.id }, select: { slug: true, qrToken: true } })
    : null;
  if (!salon) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  const search = request.nextUrl.searchParams;
  const png = search.get("format") === "png";
  const url = `${appUrl()}/q/${salon.qrToken}`;
  const body = png
    ? await QRCode.toBuffer(url, { type: "png", width: 1200, margin: 2, errorCorrectionLevel: "M" })
    : Buffer.from(await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1f1d1b", light: "#ffffff" } }));

  const current = search.get("v") === qrVersion(salon.qrToken);
  const headers: Record<string, string> = {
    "Content-Type": png ? "image/png" : "image/svg+xml; charset=utf-8",
    "Content-Length": String(body.length),
    // The image holds the secret link, so never in a shared cache; private browser cache only for the matching version.
    "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (search.get("preuzmi") === "1") headers["Content-Disposition"] = `attachment; filename="qr-${salon.slug}.${png ? "png" : "svg"}"`;
  return new NextResponse(new Uint8Array(body), { headers });
}
