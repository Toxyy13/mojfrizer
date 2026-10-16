import { NextResponse, type NextRequest } from "next/server";
import { answerQuestion, assistantRequestSchema, recordAssistantUse } from "@/lib/assistant";

import { consume, requestIp } from "@/lib/rateLimit";

// Limits live in the database (shared by all instances) so one visitor can't run up the AI bill.
// Per visitor: 20 questions / 10 min and 100 / day. Whole platform: ASSISTANT_DAILY_LIMIT (default 3000) per day.
const globalDailyLimit = (): number => Number(process.env.ASSISTANT_DAILY_LIMIT) || 3000;

export interface AssistantResponse {
  reply: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AssistantResponse | { error: string }>> {
  try {
    // Same-site requests only: another website can't use a visitor's browser to spend this budget.
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin && !origin.endsWith(`.${process.env.ROOT_DOMAIN ?? "mojfrizer.com"}`)) {
      return NextResponse.json({ error: "Zabranjeno" }, { status: 403 });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 20_000) return NextResponse.json({ error: "Neispravno pitanje" }, { status: 413 });
    const ip = await requestIp();
    const limited = await consume([
      { key: `assistant:ip:${ip}`, limit: 20, windowSec: 600 },
      { key: `assistant:ip-day:${ip}`, limit: 100, windowSec: 86_400 },
      { key: "assistant:all-day", limit: globalDailyLimit(), windowSec: 86_400 },
    ]);
    if (!limited.ok) {
      return NextResponse.json({ error: "Previše pitanja za kratko vreme. Pokušajte malo kasnije." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
    }
    const parsed = assistantRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Neispravno pitanje" }, { status: 400 });

    const result = await answerQuestion(parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await recordAssistantUse(parsed.data.slug);
    return NextResponse.json({ reply: result.reply });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Greška asistenta" }, { status: 500 });
  }
}
