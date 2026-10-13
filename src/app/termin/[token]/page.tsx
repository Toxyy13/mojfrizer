import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ManageBooking } from "@/components/ManageBooking";
import { systemDb as db } from "@/lib/db";
import { appointmentWhenFormat, canChangeOnline, loadManagedAppointment } from "@/lib/manageBooking";
import { formatPrice } from "@/lib/money";
import { servicesLabel } from "@/lib/visit";
import { fullAddress } from "@/lib/salonAddress";
import { upcomingDays } from "@/lib/salonView";
import { TIME_ZONE, todayIso } from "@/lib/time";
import { canReview } from "@/lib/reviews";
import { cancelBooking, rescheduleBooking, reviewVisit } from "./actions";

export const metadata: Metadata = { title: "Moj termin · mojfrizer", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Zakazano",
  COMPLETED: "Završeno",
  CANCELLED: "Otkazano",
  NO_SHOW: "Niste došli",
};

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await loadManagedAppointment(token);
  if (!a) notFound();

  const changeable = canChangeOnline(a);
  const [hours, daysOff] = changeable
    ? await Promise.all([
        db.workingHours.findMany({ where: { salonId: a.salonId } }),
        db.salonDayOff.findMany({ where: { salonId: a.salonId, date: { gte: new Date(`${todayIso(TIME_ZONE)}T00:00:00Z`) } } }),
      ])
    : [[], []];

  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1} className="page max-w-3xl py-10 sm:py-16">
        <div className="card p-5 sm:p-8">
        <p className="flex items-center gap-2">
          <span className="eyebrow">Moj termin</span>
          <span className={`badge ${a.status === "BOOKED" ? "bg-burgundy-soft text-burgundy" : "bg-sand text-muted"}`}>{STATUS_LABEL[a.status]}</span>
        </p>
        <h1 className={`mt-4 font-serif text-4xl leading-tight first-letter:uppercase sm:text-5xl ${a.status === "CANCELLED" ? "text-muted line-through" : ""}`}>
          {appointmentWhenFormat.format(a.startTime)}
        </h1>
        <dl className="mt-8 grid grid-cols-[6.5rem_1fr] gap-y-3 border-t border-line pt-6 text-sm">
          <dt className="text-muted">Salon</dt>
          <dd>
            <Link href={`/s/${a.salon.slug}`} className="link font-medium">
              {a.salon.name}
            </Link>
          </dd>
          <dt className="text-muted">Adresa</dt>
          <dd>{fullAddress(a.salon)}</dd>
          <dt className="text-muted">Usluga</dt>
          <dd>
            {servicesLabel(a)} · {formatPrice(a.price)}
          </dd>
          <dt className="text-muted">Frizer</dt>
          <dd>{a.worker.displayName}</dd>
          {a.salon.phone && (
            <>
              <dt className="text-muted">Telefon</dt>
              <dd>
                <a href={`tel:${a.salon.phone.replace(/\s/g, "")}`} className="link">
                  {a.salon.phone}
                </a>
              </dd>
            </>
          )}
        </dl>

        {a.status === "BOOKED" && (
          <p className="mt-8">
            <a href={`/termin/${token}/kalendar.ics`} className="btn-secondary btn-sm">
              Dodaj u kalendar telefona
            </a>
          </p>
        )}

        {a.review ? (
          <section className="card mt-8 p-6" aria-label="Vaša ocena">
            <p className="eyebrow">Vaša ocena</p>
            <p className="mt-2 text-2xl text-burgundy" aria-label={`${a.review.rating} od 5`}>
              {"★".repeat(a.review.rating)}
              <span className="text-line">{"★".repeat(5 - a.review.rating)}</span>
            </p>
            {a.review.comment && <p className="mt-2 text-sm text-muted">„{a.review.comment}”</p>}
            <p className="mt-2 text-xs text-muted">Hvala!</p>
          </section>
        ) : (
          canReview(a) && (
            <section className="card mt-8 p-6" aria-labelledby="oceni">
              <h2 id="oceni" className="font-serif text-2xl">
                Kako je bilo?
              </h2>
              <p className="field-hint mt-1">Ocena se prikazuje na stranici salona sa vašim imenom i prvim slovom prezimena.</p>
              <form action={reviewVisit.bind(null, token)} className="mt-4 grid gap-4">
                {/* Stars are in reverse DOM order, so "this one and every later sibling" = this rating and below. */}
                <fieldset className="flex flex-row-reverse justify-end gap-1 [&>label:has(:checked)]:text-burgundy [&>label:has(:checked)~label]:text-burgundy [&>label:hover]:text-burgundy [&>label:hover~label]:text-burgundy">
                  <legend className="sr-only">Ocena od 1 do 5</legend>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <label key={n} className="cursor-pointer rounded text-3xl text-[#8a847d] transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-burgundy">
                      <input type="radio" name="rating" value={n} required className="sr-only" />
                      <span aria-hidden>★</span>
                      <span className="sr-only">{n}</span>
                    </label>
                  ))}
                </fieldset>
                <textarea name="comment" rows={3} maxLength={500} placeholder="Komentar (nije obavezno)" className="field" />
                <div>
                  <button className="btn-primary btn-sm">Pošalji ocenu</button>
                </div>
              </form>
            </section>
          )
        )}

        <section className="mt-8 border-t border-line pt-8">
          {changeable ? (
            <ManageBooking
              slug={a.salon.slug}
              token={token}
              days={upcomingDays(hours, daysOff, 21)}
              cancel={cancelBooking.bind(null, token)}
              reschedule={rescheduleBooking.bind(null, token)}
            />
          ) : a.status === "BOOKED" ? (
            <p className="text-sm text-muted">
              Termin se može otkazati ili pomeriti preko sajta najkasnije {a.salon.cancelCutoffHours} h pre početka.
              {a.salon.phone ? ` Pozovite salon: ${a.salon.phone}.` : ""}
            </p>
          ) : (
            <Link href={`/s/${a.salon.slug}#zakazivanje`} className="btn-primary">
              Zakaži novi termin
            </Link>
          )}
        </section>
        </div>
      </main>
    </>
  );
}
