import { db } from "./db";
import { sendMail } from "./mail";
import { fullAddress } from "./salonAddress";
import { TIME_ZONE } from "./time";

// Remind about appointments starting within this window. The lower bound skips visits booked
// at the last minute, which don't need a reminder.
const REMIND_WITHIN_HOURS = 24;
const SKIP_IF_WITHIN_HOURS = 2;

const whenFormat = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export interface ReminderSummary {
  sent: number;
  failed: number;
}

/** Emails customers with an account about their upcoming appointment. Safe to run as often as you like. */
export async function sendDueReminders(now: Date = new Date()): Promise<ReminderSummary> {
  const from = new Date(now.getTime() + SKIP_IF_WITHIN_HOURS * 3_600_000);
  const to = new Date(now.getTime() + REMIND_WITHIN_HOURS * 3_600_000);
  const due = await db.appointment.findMany({
    where: {
      status: "BOOKED",
      reminderSentAt: null,
      startTime: { gt: from, lte: to },
      client: { email: { not: null } },
    },
    select: {
      id: true,
      startTime: true,
      client: { select: { name: true, email: true } },
      salon: { select: { name: true, slug: true, address: true, city: true, phone: true } },
      service: { select: { name: true } },
      worker: { select: { displayName: true } },
    },
    take: 200,
  });

  const summary: ReminderSummary = { sent: 0, failed: 0 };
  const baseUrl = process.env.APP_URL ?? "https://mojfrizer.com";
  for (const a of due) {
    if (!a.client?.email) continue;
    // Claim first so two overlapping runs can't both send.
    const claim = await db.appointment.updateMany({
      where: { id: a.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (claim.count === 0) continue;
    try {
      await sendMail({
        to: a.client.email,
        subject: `Podsetnik: termin u salonu ${a.salon.name}`,
        text: [
          `Zdravo ${a.client.name},`,
          "",
          `podsećamo vas na termin u salonu ${a.salon.name}:`,
          `${whenFormat.format(a.startTime)}`,
          `Usluga: ${a.service.name} (${a.worker.displayName})`,
          `Adresa: ${fullAddress(a.salon)}`,
          a.salon.phone ? `Ako ne možete da dođete, javite se salonu: ${a.salon.phone}` : "",
          "",
          `Vaši termini: ${baseUrl}/nalog`,
          "",
          "mojfrizer.com",
        ]
          .filter((line, i, all) => line !== "" || all[i - 1] !== "")
          .join("\n"),
      });
      summary.sent += 1;
    } catch (error) {
      console.error(error);
      // Let the next run try again.
      await db.appointment.update({ where: { id: a.id }, data: { reminderSentAt: null } });
      summary.failed += 1;
    }
  }
  return summary;
}
