import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, readJson, type ApiErrorBody } from "@/lib/apiError";
import { runAction, verifyProposal } from "@/lib/assistantActions";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { consume, requestIp } from "@/lib/rateLimit";
import { canViewSalon } from "@/lib/salonVisibility";
import { isSameSite } from "@/lib/sameOrigin";

const bodySchema = z.object({ token: z.string().min(20).max(4000), slug: z.string().min(1).max(80), admin: z.boolean().optional() });

/** The person pressed "Potvrdi": runs the action the assistant proposed, if the signed proposal is genuine and theirs. */
export async function POST(request: NextRequest): Promise<NextResponse<{ message: string } | ApiErrorBody>> {
  try {
    if (!isSameSite(request)) return apiError(403, "Zabranjeno.");
    const user = await getSessionUser();
    if (!user) return apiError(401, "Prijavite se.");
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(400, "Neispravan zahtev.");
    const ip = await requestIp();
    const limited = await consume([{ key: `assistant:confirm:${user.id}:${ip}`, limit: 30, windowSec: 600 }]);
    if (!limited.ok) return apiError(429, "Previše pokušaja. Pokušajte malo kasnije.", { "Retry-After": String(limited.retryAfterSec) });

    const { slug, admin } = parsed.data;
    const salon = await db.salon.findFirst({
      where: { slug, isActive: true, ...(admin ? { ownerId: user.id } : {}) },
      select: { id: true, slug: true, name: true },
    });
    if (!salon) return apiError(403, "Zabranjeno.");
    // Customer actions: a customer account that may open this salon (not staff, not a private salon they can't see).
    if (!admin && (user.role !== "CLIENT" || !(await canViewSalon(salon.id, user)))) return apiError(403, "Zabranjeno.");
    const ctx = { user, salon };
    const proposal = await verifyProposal(parsed.data.token, ctx);
    if (!proposal) return apiError(400, "Predlog je istekao. Zamolite asistenta ponovo.");
    // One press, one run: a repeated or replayed token is refused.
    if (!(await consume([{ key: `assistant:once:${proposal.jti}`, limit: 1, windowSec: 600 }])).ok) return apiError(409, "Radnja je već izvršena.");

    const result = await runAction(ctx, proposal.action, admin === true);
    return result.ok ? NextResponse.json({ message: result.message }) : apiError(400, result.error);
  } catch (error) {
    console.error(error);
    return apiError(500, "Radnja nije uspela.");
  }
}
