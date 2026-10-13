import { db, systemDb } from "./db";

// Reviews come only from completed visits, through the customer's private booking link.

const REVIEW_WINDOW_DAYS = 30;

export interface SalonRating {
  average: number; // 0 when there are no reviews
  count: number;
}

/** Only visits the customer booked online themselves count; bookings entered by the salon cannot be rated. */
export function canReview(a: { status: string; startTime: Date; source: string }, now = new Date()): boolean {
  return a.source === "ONLINE" && a.status === "COMPLETED" && now.getTime() - a.startTime.getTime() <= REVIEW_WINDOW_DAYS * 86_400_000;
}

/** "Milica Petrović" -> "Milica P." */
export function publicName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first || "Mušterija";
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function submitReview(token: string, rating: number, comment: string): Promise<ReviewResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Izaberite ocenu od 1 do 5." };
  // The booking link is the credential: system access (RLS).
  const a = await systemDb.appointment.findUnique({
    where: { manageToken: token },
    select: {
      id: true,
      salonId: true,
      status: true,
      startTime: true,
      source: true,
      clientId: true,
      guestName: true,
      client: { select: { name: true } },
      review: { select: { id: true } },
    },
  });
  if (!a) return { ok: false, error: "Termin nije pronađen." };
  if (a.review) return { ok: false, error: "Već ste ocenili ovaj dolazak." };
  if (!canReview(a)) return { ok: false, error: "Ocena je moguća do 30 dana posle završenog termina koji ste sami zakazali." };
  // The salon's own owner and staff cannot rate their salon, even through a booking made online.
  if (a.clientId) {
    const isStaff = await systemDb.salon.count({
      where: { id: a.salonId, OR: [{ ownerId: a.clientId }, { workers: { some: { userId: a.clientId } } }] },
    });
    if (isStaff > 0) return { ok: false, error: "Zaposleni u salonu ne mogu da ocenjuju svoj salon." };
  }
  await systemDb.review.create({
    data: {
      salonId: a.salonId,
      appointmentId: a.id,
      clientId: a.clientId,
      authorName: publicName(a.guestName ?? a.client?.name ?? "Mušterija"),
      rating,
      comment: comment.trim().slice(0, 500) || null,
    },
  });
  return { ok: true };
}

export async function getSalonRating(salonId: string): Promise<SalonRating> {
  const r = await db.review.aggregate({ where: { salonId }, _avg: { rating: true }, _count: true });
  return { average: r._avg.rating ?? 0, count: r._count };
}

/** Ratings for many salons at once (search results). */
export async function getSalonRatings(salonIds: string[]): Promise<Map<string, SalonRating>> {
  if (salonIds.length === 0) return new Map();
  const rows = await db.review.groupBy({
    by: ["salonId"],
    where: { salonId: { in: salonIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.salonId, { average: r._avg.rating ?? 0, count: r._count._all }]));
}

export function formatRating(average: number): string {
  return average.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Serbian plural: 1 ocena, 2 ocene, 5 ocena, 21 ocena, 22 ocene. */
export function ratingCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "ocene" : "ocena";
  return `${count} ${word}`;
}
