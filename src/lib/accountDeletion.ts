// Deleting an account also removes salons' notes about the person, which only the salon may touch: system access (RLS).
import { db, systemDb } from "./db";

// Deleting an account removes the person from everything that identifies them. Rows that salons
// need for their own books (past visits, revenue) stay, but without name, phone or notes.

export const DELETED_NAME = "Obrisan nalog";

export type DeletionResult = { ok: true } | { ok: false; error: string };

/** Permanently deletes a customer's account and personal data. Salon owners must close their salon first. */
export async function deleteAccount(userId: string): Promise<DeletionResult> {
  const user = await systemDb.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, _count: { select: { ownedSalons: true } } },
  });
  if (!user) return { ok: false, error: "Nalog nije pronađen." };
  if (user._count.ownedSalons > 0) {
    return { ok: false, error: "Nalog je vlasnik salona. Za brisanje naloga i salona pišite nam na email sa ove stranice." };
  }
  const phoneDigits = (user.phone ?? "").replace(/\D/g, "");
  const keys = [`u:${user.id}`, ...(phoneDigits.length >= 6 ? [`p:${phoneDigits.slice(-8)}`] : [])];
  const now = new Date();

  await systemDb.$transaction([
    // Future bookings are cancelled so the salon is not left waiting for a customer who no longer exists.
    systemDb.appointment.updateMany({
      where: { clientId: userId, status: "BOOKED", startTime: { gt: now } },
      data: { status: "CANCELLED" },
    }),
    systemDb.appointment.updateMany({
      where: { clientId: userId },
      data: { guestName: DELETED_NAME, guestPhone: null, note: null },
    }),
    systemDb.urgentRequest.updateMany({
      where: { clientId: userId },
      data: { guestName: DELETED_NAME, guestPhone: "-", reason: "" },
    }),
    systemDb.review.updateMany({ where: { clientId: userId }, data: { authorName: "Mušterija" } }),
    systemDb.salonClientNote.deleteMany({ where: { clientKey: { in: keys } } }),
    systemDb.chatMessage.deleteMany({ where: { OR: [{ clientId: userId }, { senderId: userId }] } }),
    // Waitlist entries, e-mail tokens and the profile photo go with the user (cascade).
    systemDb.user.delete({ where: { id: userId } }),
  ]);
  return { ok: true };
}

/** Everything we hold about one account, for the "download my data" link. */
export async function exportAccountData(userId: string): Promise<Record<string, unknown> | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      emailVerifiedAt: true,
      favoriteSalon: { select: { name: true } },
      clientAppointments: {
        orderBy: { startTime: "desc" },
        select: { startTime: true, endTime: true, status: true, price: true, note: true, salon: { select: { name: true } } },
      },
      reviews: { select: { rating: true, comment: true, createdAt: true, salon: { select: { name: true } } } },
      waitlistEntries: { select: { date: true, createdAt: true, salon: { select: { name: true } } } },
      chatAsClient: { orderBy: { createdAt: "asc" }, select: { text: true, fromSalon: true, createdAt: true, salon: { select: { name: true } } } },
    },
  });
  return user;
}
