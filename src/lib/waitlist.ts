import { appUrl } from "./appUrl";
import { db } from "./db";
import { getAvailableSlots } from "./booking";
import { sendMail } from "./mail";
import { TIME_ZONE, formatDateSr, isValidDateIso, todayIso } from "./time";

// Customers with an account can wait for a fully booked day; when a slot frees up they get one email.

export type WaitlistResult = { ok: true } | { ok: false; error: string };

export async function joinWaitlist(
  salonId: string,
  clientId: string,
  serviceId: string,
  dateIso: string,
): Promise<WaitlistResult> {
  if (!isValidDateIso(dateIso) || dateIso < todayIso(TIME_ZONE)) return { ok: false, error: "Izaberite dan." };
  const [service, client] = await Promise.all([
    db.service.findFirst({ where: { id: serviceId, salonId, isActive: true }, select: { id: true } }),
    db.user.findUnique({ where: { id: clientId }, select: { email: true } }),
  ]);
  if (!service) return { ok: false, error: "Usluga nije pronađena." };
  if (!client?.email) return { ok: false, error: "Za listu čekanja vaš nalog mora imati email adresu." };
  const date = new Date(`${dateIso}T00:00:00Z`);
  await db.waitlistEntry.upsert({
    where: { salonId_clientId_serviceId_date: { salonId, clientId, serviceId, date } },
    create: { salonId, clientId, serviceId, date },
    // Joining again after an earlier notice means "tell me again".
    update: { notifiedAt: null },
  });
  return { ok: true };
}

/**
 * Called after a booking on that day is cancelled or moved away. Emails each waiting customer whose
 * service now fits. Never throws: the change that freed the slot has already happened.
 */
export async function notifyWaitlist(salonId: string, dateIso: string): Promise<void> {
  try {
    const entries = await db.waitlistEntry.findMany({
      where: { salonId, date: new Date(`${dateIso}T00:00:00Z`), notifiedAt: null },
      include: {
        client: { select: { name: true, email: true } },
        service: { select: { name: true } },
        salon: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const baseUrl = appUrl();
    for (const e of entries) {
      if (!e.client.email) continue;
      const slots = await getAvailableSlots({ salonId, serviceId: e.serviceId, dateIso, enforceLeadTime: true });
      if (slots.length === 0) continue;
      const claim = await db.waitlistEntry.updateMany({ where: { id: e.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
      if (claim.count === 0) continue;
      await sendMail({
        to: e.client.email,
        subject: `Oslobodio se termin: ${e.salon.name}, ${formatDateSr(dateIso)}`,
        text: [
          `Zdravo ${e.client.name},`,
          "",
          `u salonu ${e.salon.name} se oslobodio termin za ${e.service.name.toLowerCase()} (${formatDateSr(dateIso)}).`,
          "Ko prvi zakaže, njegov je:",
          `${baseUrl}/s/${e.salon.slug}#zakazivanje`,
          "",
          "mojfrizer.com",
        ].join("\n"),
      }).catch((error: unknown) => console.error(error));
    }
  } catch (error) {
    console.error(error);
  }
}
