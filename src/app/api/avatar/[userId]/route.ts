import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewAvatar } from "@/lib/avatar";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { userId } = await params;
  const viewer = await getSessionUser();
  if (!viewer || !(await canViewAvatar(viewer.id, userId))) return new NextResponse(null, { status: 404 });
  // A new photo changes ?v= (see avatarUrl), so a versioned URL never goes stale and may be kept for a year.
  // Without ?v= (old links) the browser rechecks after a minute.
  const versioned = /^\d+$/.test(request.nextUrl.searchParams.get("v") ?? "");
  const avatar = await db.userAvatar.findUnique({ where: { userId } });
  if (!avatar) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mime,
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
