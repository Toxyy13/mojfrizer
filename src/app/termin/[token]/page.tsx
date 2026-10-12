import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ManageBooking } from "@/components/ManageBooking";
import { db } from "@/lib/db";
import { appointmentWhenFormat, canChangeOnline, loadManagedAppointment } from "@/lib/manageBooking";
import { formatPrice } from "@/lib/money";
import { fullAddress } from "@/lib/salonAddress";
import { upcomingDays } from "@/lib/salonView";
import { TIME_ZONE, todayIso } from "@/lib/time";
import { cancelBooking, rescheduleBooking } from "./actions";

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
      <main className="page max-w-3xl py-10 sm:py-16">
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
            {a.service.name} · {formatPrice(a.price)}
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

        <section className="mt-8 border-t border-line pt-8">
          {changeable ? (
            <ManageBooking
              slug={a.salon.slug}
              serviceId={a.serviceId}
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
