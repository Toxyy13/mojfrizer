import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/apiError";
import { getSessionUser } from "@/lib/auth";
import { MAX_AVATAR_BYTES, sniffImageType } from "@/lib/avatar";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Saves the logged-in user's profile photo (multipart field "photo"). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return apiError(401);
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return apiError(400, "Izaberite sliku.");
    if (photo.size > MAX_AVATAR_BYTES) return apiError(413, "Slika je prevelika.");
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const mime = sniffImageType(bytes);
    if (!mime) return apiError(415, "Dozvoljene su JPG, PNG i WebP slike.");
    await db.userAvatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, mime, data: bytes },
      update: { mime, data: bytes },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return apiError(500, "Čuvanje slike nije uspelo.");
  }
}

export async function DELETE(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return apiError(401);
  await db.userAvatar.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
