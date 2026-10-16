import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { MAX_AVATAR_BYTES, sniffImageType } from "@/lib/avatar";
import { db } from "@/lib/db";
import { consume } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Saves the logged-in user's profile photo (multipart field "photo"). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Prijavite se." }, { status: 401 });
  if (!(await consume([{ key: `avatar:user:${user.id}`, limit: 10, windowSec: 3600 }])).ok) {
    return NextResponse.json({ error: "Previše izmena slike. Pokušajte kasnije." }, { status: 429 });
  }
  // A declared size over the limit is refused before the body is read into memory.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_AVATAR_BYTES + 100_000) {
    return NextResponse.json({ error: "Slika je prevelika." }, { status: 413 });
  }
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return NextResponse.json({ error: "Izaberite sliku." }, { status: 400 });
    if (photo.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "Slika je prevelika." }, { status: 413 });
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const mime = sniffImageType(bytes);
    if (!mime) return NextResponse.json({ error: "Dozvoljene su JPG, PNG i WebP slike." }, { status: 415 });
    await db.userAvatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, mime, data: bytes },
      update: { mime, data: bytes },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Čuvanje slike nije uspelo." }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Prijavite se." }, { status: 401 });
  await db.userAvatar.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
