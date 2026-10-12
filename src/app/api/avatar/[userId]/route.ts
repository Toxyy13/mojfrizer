import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canViewAvatar } from "@/lib/avatar";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { userId } = await params;
  const viewer = await getSessionUser();
  if (!viewer || !(await canViewAvatar(viewer.id, userId))) return new NextResponse(null, { status: 404 });
  const avatar = await db.userAvatar.findUnique({ where: { userId } });
  if (!avatar) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mime,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
