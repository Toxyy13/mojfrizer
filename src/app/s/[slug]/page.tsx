import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice, formatServicePrice } from "@/lib/money";
import { TIME_ZONE, WEEKDAYS_SR, minutesToHHMM, todayIso, isoWeekdayOf, zonedParts } from "@/lib/time";
import { serviceCategory, toBookingServices, toBookingWorkers, upcomingDays } from "@/lib/salonView";
import { BookingForm } from "@/components/BookingForm";
import { FavoriteButton } from "@/components/FavoriteButton";
import { AssistantWidget } from "@/components/AssistantWidget";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StickyBookBar } from "@/components/StickyBookBar";
import { getSessionUser } from "@/lib/auth";
import { formatRating, getSalonRating, ratingCountLabel } from "@/lib/reviews";
import { formatPhone } from "@/lib/phone";
import { bookOnline, joinSalonWaitlist, requestUrgent } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  // "Book again" links preselect the service and hairdresser.
  searchParams?: Promise<{ usluga?: string; frizer?: string }>;
}

async function loadSalon(slug: string) {
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
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { name: true, city: true } });
  return salon ? { title: `${salon.name} · zakažite termin`, description: `${salon.name}, ${salon.city}` } : {};
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 7];

export default async function SalonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const preselect = (await searchParams) ?? {};
  const salon = await loadSalon(slug);
  if (!salon) notFound();

  const [rating, reviews] = await Promise.all([
    getSalonRating(salon.id),
    db.review.findMany({ where: { salonId: salon.id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const session = await getSessionUser();
  const customer = session
    ? await db.user.findUnique({ where: { id: session.id }, select: { name: true, phone: true, favoriteSalonId: true } })
    : null;

  const todayDate = todayIso(TIME_ZONE);
  const today = isoWeekdayOf(todayDate);
  const categories = [...new Set(salon.services.map(serviceCategory))];
  const fullAddress = salon.address.includes(salon.city) ? salon.address : `${salon.address}, ${salon.city}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&z=16&output=embed`;
  const openNow = openStatus(salon.workingHours, salon.daysOff, todayDate, today);
  const cheapest = salon.services.reduce<number | null>((min, s) => (min === null || s.price < min ? s.price : min), null);

  return (
    <>
      <SiteHeader />
      <main className="pb-24 md:pb-0">
        <section className="page pt-10 pb-10 sm:pt-16">
          <div className="animate-rise">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Frizerski salon · {salon.city}</span>
              {rating.count > 0 && (
                <a href="#ocene" className="badge bg-burgundy-soft text-burgundy">
                  ★ {formatRating(rating.average)} · {ratingCountLabel(rating.count)}
                </a>
              )}
              <span className={`badge ${openNow.open ? "bg-forest-soft text-forest" : "bg-sand text-muted"}`}>
                <span aria-hidden className={`mr-1.5 size-1.5 rounded-full ${openNow.open ? "bg-forest" : "bg-muted"}`} />
                {openNow.label}
              </span>
            </div>
            <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">{salon.name}</h1>
            <p className="mt-4 text-lg text-muted">{salon.description ?? fullAddress}</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <a href="#zakazivanje" className="btn-primary px-8">
              Zakaži termin
            </a>
            <Link href={`/poruke/${salon.slug}`} className="btn-secondary">
              Pošalji poruku
            </Link>
            {salon.phone && (
              <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="btn-secondary">
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

        <section className="page grid gap-3 md:grid-cols-3" aria-label="Informacije">
          <article className="card overflow-hidden md:col-span-2">
            <iframe
              title={`Mapa: ${fullAddress}`}
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-56 w-full border-0 grayscale-[0.3] sm:h-64"
            />
            <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
              <div>
                <h2 className="eyebrow">Adresa</h2>
                <p className="mt-2 font-serif text-2xl sm:text-3xl">{fullAddress}</p>
                {salon.phone && (
                  <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="link mt-1 inline-block text-sm text-muted">
                    {salon.phone}
                  </a>
                )}
              </div>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                Uputstva do salona ↗
              </a>
            </div>
          </article>
          <aside className="card p-5 sm:p-6">
            <h2 className="eyebrow">Radno vreme</h2>
            <dl className="mt-4 grid grid-cols-[1fr_auto] text-sm">
              {WEEK_ORDER.map((wd) => {
                const ranges = salon.workingHours.filter((x) => x.dayOfWeek === wd);
                const isToday = wd === today;
                return (
                  <div
                    key={wd}
                    className={`col-span-2 grid grid-cols-subgrid rounded-lg px-3 py-2 ${isToday ? "bg-burgundy-soft font-medium text-burgundy" : ""}`}
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

        <section className="page mt-20 grid gap-8 md:grid-cols-[1fr_2fr]" aria-labelledby="cenovnik">
          <div>
            <p className="eyebrow">Usluge</p>
            <h2 id="cenovnik" className="mt-3 font-serif text-4xl sm:text-5xl">
              Cenovnik
            </h2>
            {cheapest !== null && <p className="mt-3 text-muted">Usluge već od {formatPrice(cheapest)}.</p>}
          </div>
          <div className="grid gap-8">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="eyebrow">{category}</h3>
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {salon.services
                    .filter((s) => serviceCategory(s) === category)
                    .map((s) => (
                      <li key={s.id} className="flex items-baseline gap-4 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg">{s.name}</p>
                          <p className="text-sm text-muted">{s.durationMinutes} min</p>
                        </div>
                        <p className="max-w-[45%] text-right font-medium tabular-nums">{formatServicePrice(s)}</p>
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
                <li key={r.id} className="card p-5">
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

        <section id="zakazivanje" className="page mt-20 scroll-mt-20" aria-labelledby="zakazi-naslov">
          <div className="card grid gap-10 p-5 sm:p-8 md:grid-cols-[1fr_2fr] md:p-10">
            <div>
              <p className="eyebrow">Online zakazivanje</p>
              <h2 id="zakazi-naslov" className="mt-3 font-serif text-4xl sm:text-5xl">
                Zakažite termin
              </h2>
              <p className="mt-4 text-sm text-muted">
                Izaberite uslugu, dan i slobodno vreme. Ako vam je lakše, pozovite nas
                {salon.phone ? ` na ${salon.phone}` : ""} i zakazaćemo umesto vas.
              </p>
            </div>
            <div className="min-w-0">
              <BookingForm
                slug={salon.slug}
                mode="public"
                services={toBookingServices(salon.services)}
                workers={toBookingWorkers(salon.workers)}
                days={upcomingDays(salon.workingHours, salon.daysOff, 14)}
                submit={bookOnline.bind(null, salon.slug)}
                initialClient={customer ? { name: customer.name, phone: customer.phone ? formatPhone(customer.phone) : "" } : undefined}
                requestUrgent={requestUrgent.bind(null, salon.slug)}
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
