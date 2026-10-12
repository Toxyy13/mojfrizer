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
      <main className="mx-auto max-w-3xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          Moj termin · {STATUS_LABEL[a.status]}
        </p>
        <h1 className={`mt-6 font-serif text-5xl leading-tight first-letter:uppercase md:text-6xl ${a.status === "CANCELLED" ? "text-neutral-400 line-through" : ""}`}>
          {appointmentWhenFormat.format(a.startTime)}
        </h1>
        <dl className="mt-10 grid grid-cols-[8rem_1fr] gap-y-3 border-t border-neutral-200 pt-6 text-sm">
          <dt className="text-neutral-500">Salon</dt>
          <dd>
            <Link href={`/s/${a.salon.slug}`} className="underline underline-offset-4 hover:text-burgundy">
              {a.salon.name}
            </Link>
          </dd>
          <dt className="text-neutral-500">Adresa</dt>
          <dd>{fullAddress(a.salon)}</dd>
          <dt className="text-neutral-500">Usluga</dt>
          <dd>
            {a.service.name} · {formatPrice(a.price)}
          </dd>
          <dt className="text-neutral-500">Frizer</dt>
          <dd>{a.worker.displayName}</dd>
          {a.salon.phone && (
            <>
              <dt className="text-neutral-500">Telefon</dt>
              <dd>
                <a href={`tel:${a.salon.phone.replace(/\s/g, "")}`} className="underline underline-offset-4">
                  {a.salon.phone}
                </a>
              </dd>
            </>
          )}
        </dl>

        {a.status === "BOOKED" && (
          <p className="mt-8">
            <a href={`/termin/${token}/kalendar.ics`} className="text-sm underline underline-offset-4 hover:text-burgundy">
              Dodaj u kalendar telefona
            </a>
          </p>
        )}

        <section className="mt-12">
          {changeable ? (
            <ManageBooking
              slug={a.salon.slug}
              serviceId={a.serviceId}
              days={upcomingDays(hours, daysOff, 21)}
              cancel={cancelBooking.bind(null, token)}
              reschedule={rescheduleBooking.bind(null, token)}
            />
          ) : a.status === "BOOKED" ? (
            <p className="text-sm text-neutral-600">
              Termin se može otkazati ili pomeriti preko sajta najkasnije {a.salon.cancelCutoffHours} h pre početka.
              {a.salon.phone ? ` Pozovite salon: ${a.salon.phone}.` : ""}
            </p>
          ) : (
            <Link href={`/s/${a.salon.slug}#zakazivanje`} className="text-sm text-burgundy underline underline-offset-4">
              Zakaži novi termin
            </Link>
          )}
        </section>
      </main>
    </>
  );
}
