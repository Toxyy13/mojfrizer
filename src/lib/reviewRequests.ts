import { appUrl } from "./appUrl";
// Cron job: runs with RLS bypass, see src/lib/rls.ts.
import { systemDb as db } from "./db";
import { sendMail } from "./mail";
import { unsubscribePostUrl, unsubscribeUrl } from "./unsubscribe";

// Ask for a rating once, a little after a completed visit. Only customers with a verified email who booked
// online and did not opt out; the link opens the same rating form as the account page.
const ASK_AFTER_HOURS = 2;
const GIVE_UP_AFTER_DAYS = 7;

export interface ReviewRequestSummary {
  sent: number;
  failed: number;
}

export async function sendReviewRequests(now: Date = new Date()): Promise<ReviewRequestSummary> {
  const due = await db.appointment.findMany({
    where: {
      status: "COMPLETED",
      source: "ONLINE",
      reviewRequestSentAt: null,
      review: null,
      endTime: { lte: new Date(now.getTime() - ASK_AFTER_HOURS * 3_600_000), gt: new Date(now.getTime() - GIVE_UP_AFTER_DAYS * 86_400_000) },
      client: { email: { not: null }, emailVerifiedAt: { not: null }, emailOptOut: false },
    },
    select: { id: true, manageToken: true, clientId: true, client: { select: { name: true, email: true } }, salon: { select: { name: true, ownerId: true } } },
    take: 200,
  });

  const summary: ReviewRequestSummary = { sent: 0, failed: 0 };
  const baseUrl = appUrl();
  for (const a of due) {
    // The salon's own people don't rate their salon.
    if (!a.client?.email || !a.clientId || a.clientId === a.salon.ownerId) continue;
    const claim = await db.appointment.updateMany({ where: { id: a.id, reviewRequestSentAt: null }, data: { reviewRequestSentAt: new Date() } });
    if (claim.count === 0) continue;
    try {
      await sendMail({
        to: a.client.email,
        subject: `Kako je bilo u salonu ${a.salon.name}?`,
        text: [
          `Zdravo ${a.client.name},`,
          "",
          `hvala što ste bili u salonu ${a.salon.name}. Ako imate minut, ocenite posetu (1 do 5 zvezdica, komentar nije obavezan):`,
          `${baseUrl}/termin/${a.manageToken}`,
          "",
          "Ocena se prikazuje na stranici salona sa vašim imenom i prvim slovom prezimena.",
        ].join("\n"),
        unsubscribe: { pageUrl: unsubscribeUrl(a.clientId), postUrl: unsubscribePostUrl(a.clientId) },
      });
      summary.sent += 1;
    } catch (error) {
      console.error(error);
      await db.appointment.update({ where: { id: a.id }, data: { reviewRequestSentAt: null } });
      summary.failed += 1;
    }
  }
  return summary;
}
