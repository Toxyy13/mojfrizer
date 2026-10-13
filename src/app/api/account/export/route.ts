import { NextResponse } from "next/server";
import { exportAccountData } from "@/lib/accountDeletion";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Machine-readable copy of the signed-in person's data (right of access and portability). */
export async function GET(): Promise<NextResponse> {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Prijavite se." }, { status: 401 });
  const data = await exportAccountData(session.id);
  if (!data) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });
  // Pretty-printed for people who open it in a text editor; the file is small, so this costs nothing.
  const body = JSON.stringify(data, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="moji-podaci-mojfrizer.json"',
      "Content-Length": String(Buffer.byteLength(body)),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
