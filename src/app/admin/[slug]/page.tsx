import Link from "next/link";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalonAccess } from "@/lib/access";
import { getRevenue } from "@/lib/revenue";
import { formatRsd } from "@/lib/money";
import { TIME_ZONE, addDaysIso, formatDateSr, formatLocalTime, isValidDateIso, localToUtc, todayIso } from "@/lib/time";
import { toBookingServices, toBookingWorkers, upcomingDays } from "@/lib/salonView";
import { BookingForm } from "@/components/BookingForm";
import { logout } from "@/app/prijava/actions";
import { bookForClient, setAppointmentStatus } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Zakazano",
  COMPLETED: "Završeno",
  CANCELLED: "Otkazano",
  NO_SHOW: "Nije došao",
};

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  BOOKED: "border-neutral-300",
  COMPLETED: "border-forest text-neutral-500",
  CANCELLED: "border-neutral-200 text-neutral-400 line-through",
  NO_SHOW: "border-burgundy text-neutral-500",
};

export default async function AdminSalonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { salon, user } = await requireSalonAccess(slug);
  const sp = await searchParams;
  const today = todayIso(TIME_ZONE);
  const dateIso = sp.date && isValidDateIso(sp.date) ? sp.date : today;

  const dayStart = localToUtc(dateIso, 0, TIME_ZONE);
  const dayEnd = localToUtc(dateIso, 24 * 60, TIME_ZONE);
  const monthStartIso = `${dateIso.slice(0, 7)}-01`;
  const [y, m] = dateIso.split("-").map(Number);
  const nextMonthIso = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const [workers, services, hours, daysOff, appointments, dayRevenue, monthRevenue] = await Promise.all([
    db.workerProfile.findMany({ where: { salonId: salon.id, isActive: true }, orderBy: { displayName: "asc" } }),
    db.service.findMany({ where: { salonId: salon.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.workingHours.findMany({ where: { salonId: salon.id } }),
    db.salonDayOff.findMany({ where: { salonId: salon.id, date: { gte: new Date(`${dateIso}T00:00:00Z`) } } }),
    db.appointment.findMany({
      where: { salonId: salon.id, startTime: { gte: dayStart, lt: dayEnd } },
      include: { service: true, client: { select: { name: true, phone: true } } },
      orderBy: { startTime: "asc" },
    }),
    getRevenue(salon.id, dayStart, dayEnd),
    getRevenue(
      salon.id,
      localToUtc(monthStartIso, 0, TIME_ZONE),
      localToUtc(nextMonthIso, 0, TIME_ZONE),
    ),
  ]);

  const statusAction = setAppointmentStatus.bind(null, slug);
  const activeCount = appointments.filter((a) => a.status === "BOOKED").length;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-neutral-200 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Admin · {user.name}</p>
          <h1 className="font-serif text-5xl">{salon.name}</h1>
        </div>
        <nav className="flex gap-6 text-sm">
          <Link href={`/s/${salon.slug}`} className="underline underline-offset-4 hover:text-burgundy">
            Javna stranica
          </Link>
          <form action={logout}>
            <button className="underline underline-offset-4 hover:text-burgundy">Odjava</button>
          </form>
        </nav>
      </header>

      <section className="grid gap-px border-b border-neutral-200 bg-neutral-200 md:grid-cols-4" aria-label="Pregled">
        <div className="bg-white py-8 pr-8 md:col-span-2">
          <div className="flex items-center gap-4">
            <Link href={`?date=${addDaysIso(dateIso, -1)}`} aria-label="Prethodni dan" className="text-2xl hover:text-burgundy">
              ←
            </Link>
            <h2 className="font-serif text-3xl">{formatDateSr(dateIso)}</h2>
            <Link href={`?date=${addDaysIso(dateIso, 1)}`} aria-label="Sledeći dan" className="text-2xl hover:text-burgundy">
              →
            </Link>
            {dateIso !== today && (
              <Link href="?" className="text-sm underline underline-offset-4 hover:text-burgundy">
                Danas
              </Link>
            )}
          </div>
          <p className="mt-2 text-sm text-neutral-500">{activeCount} zakazanih termina</p>
        </div>
        <div className="bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Pazar za dan</p>
          <p className="mt-2 font-mono text-2xl">{formatRsd(dayRevenue.totalPara)}</p>
          <p className="text-xs text-neutral-500">{dayRevenue.completedCount} završenih</p>
        </div>
        <div className="bg-white p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Pazar za mesec</p>
          <p className="mt-2 font-mono text-2xl">{formatRsd(monthRevenue.totalPara)}</p>
          <p className="text-xs text-neutral-500">{monthRevenue.completedCount} završenih</p>
        </div>
      </section>

      <section className="mt-12 grid gap-12 lg:grid-cols-3">
        <div className={`grid min-w-0 gap-8 lg:col-span-2 ${workers.length > 1 ? "md:grid-cols-2" : ""}`}>
          {workers.map((w) => {
            const list = appointments.filter((a) => a.workerId === w.id);
            return (
              <article key={w.id} aria-label={`Termini: ${w.displayName}`}>
                <h3 className="border-b border-charcoal pb-2 text-xs uppercase tracking-[0.2em]">{w.displayName}</h3>
                {list.length === 0 && <p className="py-6 text-sm text-neutral-400">Nema termina.</p>}
                <ol>
                  {list.map((a) => (
                    <li key={a.id} className={`border-b border-l-2 py-4 pl-4 ${STATUS_STYLE[a.status]}`}>
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm">
                          {formatLocalTime(a.startTime, TIME_ZONE)}–{formatLocalTime(a.endTime, TIME_ZONE)}
                        </span>
                        <span className="font-medium">{a.guestName ?? a.client?.name ?? "Mušterija"}</span>
                        {a.source === "SALON" && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">salon</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm">
                        {a.service.name} · {formatRsd(a.price)} ·{" "}
                        <PhoneLink phone={a.guestPhone ?? a.client?.phone ?? null} />
                      </p>
                      {a.note && <p className="mt-1 text-xs italic text-neutral-500">{a.note}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-neutral-500">{STATUS_LABEL[a.status]}</span>
                        {a.status === "BOOKED" ? (
                          <>
                            <StatusButton action={statusAction} id={a.id} status="COMPLETED" label="Završeno" />
                            <StatusButton action={statusAction} id={a.id} status="NO_SHOW" label="Nije došao" />
                            <StatusButton action={statusAction} id={a.id} status="CANCELLED" label="Otkaži" />
                          </>
                        ) : (
                          <StatusButton action={statusAction} id={a.id} status="BOOKED" label="Vrati na zakazano" />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>

        <aside className="min-w-0 border border-neutral-200 p-8 lg:sticky lg:top-6 lg:self-start" aria-labelledby="novi-termin">
          <h2 id="novi-termin" className="font-serif text-3xl">Upiši termin za mušteriju</h2>
          <p className="mt-2 text-sm text-neutral-500">Za mušterije koje zovu telefonom ili dođu u salon.</p>
          <div className="mt-8">
            <BookingForm
              key={dateIso}
              slug={salon.slug}
              mode="salon"
              services={toBookingServices(services)}
              workers={toBookingWorkers(workers)}
              days={upcomingDays(hours, daysOff, 21, dateIso)}
              submit={bookForClient.bind(null, salon.slug)}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function PhoneLink({ phone }: { phone: string | null }) {
  if (!phone) return <span className="text-neutral-400">bez telefona</span>;
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className="underline underline-offset-2">
      {phone}
    </a>
  );
}

function StatusButton(props: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  status: AppointmentStatus;
  label: string;
}) {
  return (
    <form action={props.action}>
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="status" value={props.status} />
      <button className="border border-neutral-300 px-2 py-1 transition-colors hover:border-charcoal">{props.label}</button>
    </form>
  );
}
