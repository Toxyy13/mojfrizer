import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice, formatServicePrice } from "@/lib/money";
import { TIME_ZONE, WEEKDAYS_SR, minutesToHHMM, todayIso, isoWeekdayOf, zonedParts } from "@/lib/time";
import { serviceCategory, toBookingServices, toBookingWorkers, upcomingDays } from "@/lib/salonView";
import { MapEmbed } from "@/components/MapEmbed";
import { BookingForm } from "@/components/BookingForm";
import { UrgentBookingCard } from "@/components/UrgentBookingCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AssistantWidget } from "@/components/AssistantWidget";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StickyBookBar } from "@/components/StickyBookBar";
import { getSessionUser } from "@/lib/auth";
import { canViewSalon, isSalonRole } from "@/lib/salonVisibility";
import { logout } from "@/app/prijava/actions";
import { formatRating, getSalonRating, ratingCountLabel } from "@/lib/reviews";
import { SocialLinks } from "@/components/SocialLinks";
import { formatPhone } from "@/lib/phone";
import { bookOnline, joinSalonWaitlist, requestUrgent, startUrgentBooking } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  // "Book again" links preselect the service and hairdresser.
  searchParams?: Promise<{ usluga?: string; frizer?: string }>;
}

// cache(): the page and generateMetadata share one query per request (never across requests or visitors).
const loadSalon = cache(async (slug: string) => {
  return db.salon.findFirst({
    where: { slug, isActive: true },
    include: {
      workingHours: { orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] },
      daysOff: { where: { date: { gte: new Date(`${todayIso(TIME_ZONE)}T00:00:00Z`) } } },
      services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      workers: { where: { isActive: true }, orderBy: { displayName: "asc" } },
      serviceCombos: { select: { serviceIds: true, durationMinutes: true } },
    },
  });
});

// Same rule for metadata and page, asked once per request (the memo is per request and keyed by who asks).
const requestMemo = cache(() => new Map<string, Promise<boolean>>());
function canViewOnce(salonId: string, session: Awaited<ReturnType<typeof getSessionUser>>): Promise<boolean> {
  const memo = requestMemo();
  const key = `${salonId}:${session?.id ?? ""}`;
  let result = memo.get(key);
  if (!result) memo.set(key, (result = canViewSalon(salonId, session)));
  return result;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const salon = await loadSalon(slug);
  // Private salons stay hidden from visitors who aren't connected to them (no meta tags leak).
  return salon && (await canViewOnce(salon.id, await getSessionUser()))
    ? { title: `${salon.name} · zakažite termin`, description: `${salon.name}, ${salon.city}` }
    : {};
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 7];

export default async function SalonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const preselect = (await searchParams) ?? {};
  const [salon, session] = await Promise.all([loadSalon(slug), getSessionUser()]);
  if (!salon) notFound();
  // Visibility check and the page's other data are independent, so they run together (one wave of queries, not three).
  const [canView, rating, reviews, customer] = await Promise.all([
    canViewOnce(salon.id, session),
    getSalonRating(salon.id),
    db.review.findMany({ where: { salonId: salon.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    session?.role === "CLIENT" ? db.user.findUnique({ where: { id: session.id }, select: { name: true, phone: true, favoriteSalonId: true } }) : null,
  ]);
  if (!canView) notFound();

  const todayDate = todayIso(TIME_ZONE);
  const today = isoWeekdayOf(todayDate);
  const categories = [...new Set(salon.services.map(serviceCategory))];
  const fullAddress = salon.address.includes(salon.city) ? salon.address : `${salon.address}, ${salon.city}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&z=16&output=embed`;
  const openNow = openStatus(salon.workingHours, salon.daysOff, todayDate, today);
  const tel = salon.phone?.replace(/\s/g, "");
  const bookingServices = toBookingServices(salon.services);
  const bookingWorkers = toBookingWorkers(salon.workers);
  const bookingDays = upcomingDays(salon.workingHours, salon.daysOff, 14);
  // A salon login sees the page exactly as a guest does (that is the customer's view), plus a bar to leave it.
  const salonLogin = isSalonRole(session?.role);
  const cheapest = salon.services.reduce<number | null>((min, s) => (min === null || s.price < min ? s.price : min), null);

  return (
    <>
      <SiteHeader />
      {salonLogin && (
        <div className="border-b border-line bg-burgundy-soft">
          <div className="page flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <p>Prijavljeni ste kao salon. Ovo je stranica kakvu vide mušterije.</p>
            <div className="flex items-center gap-2">
              <Link href="/admin" className="btn-primary btn-sm">
                Otvori admin
              </Link>
              <form action={logout}>
                <button className="btn-secondary btn-sm">Odjava</button>
              </form>
            </div>
          </div>
        </div>
      )}
      <main id="sadrzaj" tabIndex={-1} className="pb-24 md:pb-0">
        <div aria-hidden className="awning" />
        <section className="page pt-8 pb-10 sm:pt-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Frizerski salon · {salon.city}</span>
            {rating.count > 0 && (
              <a href="#ocene" className="badge border border-burgundy/40 bg-burgundy-soft text-burgundy">
                ★ {formatRating(rating.average)} · {ratingCountLabel(rating.count)}
              </a>
            )}
          </div>
          <div className="mt-4 flex items-stretch gap-3 sm:gap-5">
            <h1 className="sign-text min-w-0 flex-1 rounded-3xl bg-charcoal px-6 py-8 text-[clamp(2.5rem,9vw,6.5rem)] leading-[0.95] break-words shadow-[0_30px_60px_-30px_rgb(17_24_39/0.7)] sm:px-10 sm:py-12">
              {salon.name}
            </h1>
            <div aria-hidden className="pole w-5 shrink-0 sm:w-8" />
          </div>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-lg text-muted">
            <span className={`badge ${openNow.open ? "bg-forest-soft text-forest" : "bg-sand text-muted"}`}>
              <span aria-hidden className={`mr-1.5 size-2 rounded-full ${openNow.open ? "animate-pulse bg-forest" : "bg-muted"}`} />
              {openNow.label}
            </span>
            <span className="max-w-2xl">{salon.description ?? fullAddress}</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <a href="#zakazivanje" className="btn-primary px-8">
              Zakaži termin
            </a>
            <Link href={`/poruke/${salon.slug}`} className="btn-secondary">
              Pošalji poruku
            </Link>
            {salon.phone && (
              <a href={`tel:${tel}`} className="btn-secondary">
                Pozovi
              </a>
            )}
            {customer ? (
              <FavoriteButton salonId={salon.id} isFavorite={customer.favoriteSalonId === salon.id} returnTo={`/s/${salon.slug}`} />
            ) : (
              <Link href={`/prijava?next=/s/${salon.slug}`} className="btn-ghost">
                ♡ Prijavite se da sačuvate salon
              </Link>
            )}
          </div>
        </section>

        <section className="page reveal grid gap-3 md:grid-cols-3" aria-label="Informacije">
          <article className="card-ink overflow-hidden md:col-span-2">
            <MapEmbed address={fullAddress} src={mapEmbedUrl} />
            <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
              <div>
                <h2 className="eyebrow">Adresa</h2>
                <p className="mt-2 font-serif text-2xl sm:text-3xl">{fullAddress}</p>
                {salon.phone && (
                  <a href={`tel:${tel}`} className="link mt-1 inline-block text-sm text-muted">
                    {salon.phone}
                  </a>
                )}
                <SocialLinks instagram={salon.instagramUrl} facebook={salon.facebookUrl} tiktok={salon.tiktokUrl} />
              </div>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                Uputstva do salona ↗
              </a>
            </div>
          </article>
          <aside className="card-ink p-5 sm:p-6">
            <h2 className="eyebrow">Radno vreme</h2>
            <dl className="mt-4 grid grid-cols-[1fr_auto] text-sm">
              {WEEK_ORDER.map((wd) => {
                const ranges = salon.workingHours.filter((x) => x.dayOfWeek === wd);
                const isToday = wd === today;
                return (
                  <div
                    key={wd}
                    className={`col-span-2 grid grid-cols-subgrid rounded-lg px-3 py-2 ${isToday ? "bg-charcoal font-semibold text-white" : ""}`}
                  >
                    <dt>
                      {WEEKDAYS_SR[wd]}
                      {isToday && <span className="ml-2 text-xs font-normal">danas</span>}
                    </dt>
                    <dd className={`tabular-nums ${ranges.length === 0 ? "text-muted" : ""}`}>
                      {ranges.length > 0
                        ? ranges.map((r) => `${minutesToHHMM(r.opensAt)}–${minutesToHHMM(r.closesAt)}`).join(", ")
                        : "zatvoreno"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </aside>
        </section>

        <section className="page reveal mt-24 grid gap-8 md:grid-cols-[1fr_2fr]" aria-labelledby="cenovnik">
          <div>
            <p className="eyebrow">Usluge</p>
            <h2 id="cenovnik" className="mt-3 font-serif text-5xl leading-none font-bold sm:text-7xl">
              Cenovnik
            </h2>
            {cheapest !== null && <p className="mt-3 text-muted">Usluge već od {formatPrice(cheapest)}.</p>}
          </div>
          <div className="board grid gap-8 p-6 sm:p-10">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="font-serif text-xl tracking-[0.14em] text-[#f0b64a]">{category}</h3>
                <ul className="mt-3 grid gap-4">
                  {salon.services
                    .filter((s) => serviceCategory(s) === category)
                    .map((s) => (
                      <li key={s.id} className="board-row">
                        <p className="text-lg font-medium">
                          {s.name} <span className="ml-1 text-sm font-normal text-cream/60">{s.durationMinutes} min</span>
                        </p>
                        <span aria-hidden className="board-dots" />
                        <p className="font-serif text-xl tabular-nums">{formatServicePrice(s)}</p>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {reviews.length > 0 && (
          <section id="ocene" className="page mt-20 grid scroll-mt-20 gap-8 md:grid-cols-[1fr_2fr]" aria-labelledby="ocene-naslov">
            <div>
              <p className="eyebrow">Utisci mušterija</p>
              <h2 id="ocene-naslov" className="mt-3 font-serif text-4xl sm:text-5xl">
                ★ {formatRating(rating.average)}
              </h2>
              <p className="mt-3 text-muted">
                {ratingCountLabel(rating.count)}, samo od mušterija koje su bile u salonu.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="card-ink p-5 odd:-rotate-1 even:rotate-1">
                  <p className="text-burgundy" aria-label={`${r.rating} od 5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                  </p>
                  {r.comment && <p className="mt-2 text-sm">„{r.comment}”</p>}
                  <p className="mt-3 text-xs text-muted">{r.authorName}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="zakazivanje" className="page mt-24 scroll-mt-20" aria-labelledby="zakazi-naslov">
          <div className="card-ink grid gap-10 p-5 sm:p-8 md:grid-cols-[1fr_2fr] md:p-10">
            <div>
              <p className="eyebrow">Online zakazivanje</p>
              <h2 id="zakazi-naslov" className="mt-3 font-serif text-5xl font-bold leading-none sm:text-6xl">
                Zakažite termin
              </h2>
              <p className="mt-4 text-sm text-muted">
                Izaberite uslugu, dan i slobodno vreme. Ako vam je lakše, pozovite nas
                {salon.phone ? ` na ${salon.phone}` : ""} i zakazaćemo umesto vas.
              </p>
            </div>
            <div className="grid min-w-0 gap-8">
              <UrgentBookingCard
                slug={salon.slug}
                services={bookingServices}
                workers={bookingWorkers}
                days={bookingDays}
                surcharge={salon.urgentSurcharge}
                viewer={!session || salonLogin ? "guest" : session.role === "CLIENT" ? "client" : "other"}
                start={startUrgentBooking.bind(null, salon.slug)}
              />
              <BookingForm
                slug={salon.slug}
                mode="public"
                services={bookingServices}
                workers={bookingWorkers}
                days={bookingDays}
                submit={bookOnline.bind(null, salon.slug)}
                initialClient={customer ? { name: customer.name, phone: customer.phone ? formatPhone(customer.phone) : "" } : undefined}
                requestUrgent={requestUrgent.bind(null, salon.slug)}
                urgentSurcharge={salon.urgentSurcharge}
                joinWaitlist={joinSalonWaitlist.bind(null, salon.slug)}
                initialServiceIds={preselect.usluga?.split(",").filter(Boolean)}
                combos={salon.serviceCombos}
                initialWorkerId={preselect.frizer}
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyBookBar targetId="zakazivanje" label="Zakaži termin" hint={openNow.label} />
      <AssistantWidget slug={salon.slug} salonName={salon.name} />
    </>
  );
}

/** "Otvoreno do 19:00" / "Zatvoreno · otvara u 09:00" for the badge under the salon name. */
function openStatus(
  hours: Array<{ dayOfWeek: number; opensAt: number; closesAt: number }>,
  daysOff: Array<{ date: Date }>,
  todayDate: string,
  weekday: number,
): { open: boolean; label: string } {
  const now = zonedParts(new Date(), TIME_ZONE);
  const minute = now.hour * 60 + now.minute;
  const dayOff = daysOff.some((d) => d.date.toISOString().slice(0, 10) === todayDate);
  const ranges = dayOff ? [] : hours.filter((h) => h.dayOfWeek === weekday);
  const current = ranges.find((r) => r.opensAt <= minute && minute < r.closesAt);
  if (current) return { open: true, label: `Otvoreno do ${minutesToHHMM(current.closesAt)}` };
  const later = ranges.find((r) => r.opensAt > minute);
  if (later) return { open: false, label: `Zatvoreno · otvara u ${minutesToHHMM(later.opensAt)}` };
  return { open: false, label: "Danas zatvoreno" };
}
