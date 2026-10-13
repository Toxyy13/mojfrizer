// Trusted internal code (tokens, mail, cron, login): runs with RLS bypass, see src/lib/rls.ts.
import { systemDb as db } from "./db";
import { DELETED_NAME } from "./accountDeletion";

// Retention periods promised in the privacy policy (src/app/privatnost/page.tsx).
const VISIT_MONTHS = 24;
const URGENT_MONTHS = 12;
const TOKEN_DAYS = 7;

const monthsAgo = (months: number): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
};

export interface PurgeSummary {
  visits: number;
  chat: number;
  urgent: number;
  tokens: number;
}

/** Removes personal data past its retention period. Safe to run on every cron call. */
export async function purgeExpiredData(): Promise<PurgeSummary> {
  const visitCutoff = monthsAgo(VISIT_MONTHS);
  const [visits, chat, urgent, tokens] = await Promise.all([
    db.appointment.updateMany({
      where: { startTime: { lt: visitCutoff }, OR: [{ guestName: { not: DELETED_NAME } }, { guestPhone: { not: null } }, { note: { not: null } }] },
      data: { guestName: DELETED_NAME, guestPhone: null, note: null },
    }),
    db.chatMessage.deleteMany({ where: { createdAt: { lt: visitCutoff } } }),
    db.urgentRequest.updateMany({
      where: { createdAt: { lt: monthsAgo(URGENT_MONTHS) }, guestPhone: { not: "-" } },
      data: { guestName: DELETED_NAME, guestPhone: "-", reason: "" },
    }),
    db.emailToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - TOKEN_DAYS * 86_400_000) } } }),
  ]);
  return { visits: visits.count, chat: chat.count, urgent: urgent.count, tokens: tokens.count };
}
