import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/apiError";
import { isValidUnsubscribe, unsubscribeUser } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

/** One-click unsubscribe (RFC 8058): mail apps POST here when the person taps "Unsubscribe". */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.nextUrl.searchParams.get("u") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!isValidUnsubscribe(userId, token)) return apiError(400, "Link nije ispravan.");
  await unsubscribeUser(userId);
  return NextResponse.json({ ok: true });
}
