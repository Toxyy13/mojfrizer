import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJson, type ApiErrorBody } from "@/lib/apiError";
import { answerQuestion, assistantRequestSchema, recordAssistantUse } from "@/lib/assistant";

// Simple per-instance limit so one visitor can't run up the AI bill.
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS = 20;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_REQUESTS;
}

export interface AssistantResponse {
  reply: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AssistantResponse | ApiErrorBody>> {
  try {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    if (isRateLimited(ip)) {
      return apiError(429, "Previše pitanja za kratko vreme. Pokušajte malo kasnije.", { "Retry-After": "600" });
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
