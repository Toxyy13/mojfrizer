import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/lib/reminders";
import { sendReviewRequests } from "@/lib/reviewRequests";
import { purgeExpiredData } from "@/lib/retention";
import { purgeRateLimits } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Called by a scheduler (e.g. every 30 minutes) with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const reminders = await sendDueReminders();
    const reviewRequests = await sendReviewRequests().catch((error: unknown) => {
      console.error(error);
      return null;
    });
    // Same schedule also enforces the data retention periods from the privacy policy.
    const purged = await purgeExpiredData().catch((error: unknown) => {
      console.error(error);
      return null;
    });
    await purgeRateLimits().catch((error: unknown) => console.error(error));
    return NextResponse.json({ ...reminders, reviewRequests, purged });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
