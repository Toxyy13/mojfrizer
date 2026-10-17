import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJson, type ApiErrorBody } from "@/lib/apiError";
import { answerQuestion, assistantRequestSchema, recordAssistantUse } from "@/lib/assistant";
import { consume, requestIp } from "@/lib/rateLimit";
import { isSameSite } from "@/lib/sameOrigin";

// Limits live in the database (shared by all instances) so one visitor can't run up the AI bill.
// Per visitor: 20 questions / 10 min and 100 / day. Whole platform: ASSISTANT_DAILY_LIMIT (default 3000) per day.
const globalDailyLimit = (): number => Number(process.env.ASSISTANT_DAILY_LIMIT) || 3000;

export interface AssistantResponse {
  reply: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AssistantResponse | ApiErrorBody>> {
  try {
    // Same-site requests only: another website can't use a visitor's browser to spend this budget.
    if (!isSameSite(request)) return apiError(403, "Zabranjeno.");
    if (Number(request.headers.get("content-length") ?? 0) > 20_000) return apiError(413, "Neispravno pitanje.");
    const ip = await requestIp();
    const limited = await consume([
      { key: `assistant:ip:${ip}`, limit: 20, windowSec: 600 },
      { key: `assistant:ip-day:${ip}`, limit: 100, windowSec: 86_400 },
      { key: "assistant:all-day", limit: globalDailyLimit(), windowSec: 86_400 },
    ]);
    if (!limited.ok) {
      return apiError(429, "Previše pitanja za kratko vreme. Pokušajte malo kasnije.", { "Retry-After": String(limited.retryAfterSec) });
    }
    const parsed = assistantRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(400, "Neispravno pitanje.");

    const result = await answerQuestion(parsed.data);
    if (!result.ok) return apiError(result.status, result.error);
    await recordAssistantUse(parsed.data.slug);
    return NextResponse.json({ reply: result.reply });
  } catch (error) {
    console.error(error);
    return apiError(500, "Greška asistenta.");
  }
}
