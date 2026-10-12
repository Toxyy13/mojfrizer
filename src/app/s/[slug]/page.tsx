import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { TIME_ZONE, WEEKDAYS_SR, minutesToHHMM, todayIso, isoWeekdayOf } from "@/lib/time";
import { serviceCategory, toBookingServices, toBookingWorkers, upcomingDays } from "@/lib/salonView";
import { BookingForm } from "@/components/BookingForm";
import { bookOnline } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function loadSalon(slug: string) {
  return db.salon.findFirst({
    where: { slug, isActive: true },
    include: {
      workingHours: { orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] },
      daysOff: { where: { date: { gte: new Date(`${todayIso(TIME_ZONE)}T00:00:00Z`) } } },
      services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      workers: { where: { isActive: true }, orderBy: { displayName: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { name: true, city: true } });
  return salon ? { title: `${salon.name} · zakažite termin`, description: `${salon.name}, ${salon.city}` } : {};
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 7];

export default async function SalonPage({ params }: PageProps) {
  const { slug } = await params;
  const salon = await loadSalon(slug);
  if (!salon) notFound();

  const today = isoWeekdayOf(todayIso(TIME_ZONE));
  const categories = [...new Set(salon.services.map(serviceCategory))];
  const fullAddress = salon.address.includes(salon.city) ? salon.address : `${salon.address}, ${salon.city}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <main>
      <header className="border-b border-neutral-200 bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Frizerski salon · {salon.city}</p>
          <h1 className="mt-6 font-serif text-7xl leading-[0.9] md:text-9xl">{salon.name}</h1>
          <a
            href="#zakazivanje"
            className="mt-12 inline-block bg-burgundy px-10 py-4 text-sm uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark"
          >
            Zakaži termin
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-px border-x border-neutral-200 bg-neutral-200 md:grid-cols-3" aria-label="Informacije">
        <article className="bg-white p-10 md:col-span-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-500">Adresa</h2>
          <p className="mt-4 font-serif text-4xl">{fullAddress}</p>
          {salon.description && <p className="mt-2 text-neutral-600">{salon.description}</p>}
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-burgundy">
              Otvori mapu
            </a>
            {salon.phone && (
              <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="underline underline-offset-4 hover:text-burgundy">
                {salon.phone}
              </a>
            )}
          </div>
        </article>
        <aside className="bg-white p-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-500">Radno vreme</h2>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            {WEEK_ORDER.map((wd) => {
              const ranges = salon.workingHours.filter((x) => x.dayOfWeek === wd);
              const isToday = wd === today;
              return (
                <div key={wd} className={`contents ${isToday ? "font-semibold text-burgundy" : ""}`}>
                  <dt>{WEEKDAYS_SR[wd]}</dt>
                  <dd className="font-mono">{ranges.length > 0
                      ? ranges.map((r) => `${minutesToHHMM(r.opensAt)}–${minutesToHHMM(r.closesAt)}`).join(", ")
                      : "zatvoreno"}</dd>
                </div>
              );
            })}
          </dl>
        </aside>
      </section>

      <section className="border-t border-neutral-200 py-24" aria-labelledby="cenovnik">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-3">
          <h2 id="cenovnik" className="font-serif text-5xl">Cenovnik</h2>
          <div className="md:col-span-2">
            {categories.map((category) => (
              <div key={category} className="mb-10">
                <h3 className="text-xs uppercase tracking-[0.2em] text-neutral-500">{category}</h3>
                <ul className="mt-2">
                  {salon.services
                    .filter((s) => serviceCategory(s) === category)
                    .map((s) => (
                      <li key={s.id} className="flex items-baseline gap-4 border-b border-neutral-200 py-4">
                        <span className="text-lg">{s.name}</span>
                        <span className="text-xs text-neutral-400">{s.durationMinutes} min</span>
                        <span className="ml-auto font-mono">{formatPrice(s.price)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="zakazivanje" className="border-t border-neutral-200 bg-cream py-24" aria-labelledby="zakazi-naslov">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-3">
          <div>
            <h2 id="zakazi-naslov" className="font-serif text-5xl">Zakažite termin</h2>
            <p className="mt-4 text-sm text-neutral-600">
              Izaberite uslugu, dan i slobodno vreme. Ako vam je lakše, pozovite nas{salon.phone ? ` na ${salon.phone}` : ""} i
              zakazaćemo umesto vas.
            </p>
          </div>
          <div className="min-w-0 md:col-span-2">
            <BookingForm
              slug={salon.slug}
              mode="public"
              services={toBookingServices(salon.services)}
              workers={toBookingWorkers(salon.workers)}
              days={upcomingDays(salon.workingHours, salon.daysOff, 14)}
              submit={bookOnline.bind(null, salon.slug)}
            />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl justify-between px-6 py-10 text-xs text-neutral-500">
        <span>© {salon.name}</span>
        <Link href="/prijava" className="hover:text-burgundy">
          Prijava
        </Link>
      </footer>
    </main>
  );
}
