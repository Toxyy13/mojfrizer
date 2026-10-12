import Link from "next/link";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { Avatar } from "@/components/Avatar";
import { avatarUrl } from "@/lib/avatar";
import { requireSalonAccess } from "@/lib/access";
import { unreadForSalon } from "@/lib/chat";
import { clientFlags, clientKeyOf } from "@/lib/clients";
import { getRevenue } from "@/lib/revenue";
import { formatRsd } from "@/lib/money";
import { TIME_ZONE, addDaysIso, formatDateSr, formatLocalTime, isValidDateIso, localToUtc, todayIso } from "@/lib/time";
import { toBookingServices, toBookingWorkers, upcomingDays } from "@/lib/salonView";
import { BookingForm } from "@/components/BookingForm";
import { logout } from "@/app/prijava/actions";
import { bookForClient, closeUrgentRequest, setAppointmentStatus, swapForUrgent } from "./actions";
import { UrgentRequests, type UrgentRequestView } from "./UrgentRequests";

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
      include: { service: true, client: { select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } } } },
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
  const urgentRequests = await loadUrgentRequests(salon.id, today);
  const unreadMessages = await unreadForSalon(salon.id);
  const activeCount = appointments.filter((a) => a.status === "BOOKED").length;
  const flags = await clientFlags(salon.id, appointments.map(clientKeyOf));

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-neutral-200 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Admin · {user.name}</p>
          <h1 className="font-serif text-5xl">{salon.name}</h1>
        </div>
        <nav className="flex gap-6 text-sm">
          <Link href={`/admin/${salon.slug}/poruke`} className="underline underline-offset-4 hover:text-burgundy">
            Poruke{unreadMessages > 0 ? ` (${unreadMessages})` : ""}
          </Link>
          <Link href={`/admin/${salon.slug}/musterije`} className="underline underline-offset-4 hover:text-burgundy">
            Mušterije
          </Link>
          {salon.ownerId === user.id && (
            <Link href={`/admin/${salon.slug}/izvestaji`} className="underline underline-offset-4 hover:text-burgundy">
              Izveštaji
            </Link>
          )}
          {salon.ownerId === user.id && (
            <Link href={`/admin/${salon.slug}/podesavanja`} className="underline underline-offset-4 hover:text-burgundy">
              Podešavanja
            </Link>
          )}
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

      {urgentRequests.length > 0 && (
        <UrgentRequests
          requests={urgentRequests}
          swap={swapForUrgent.bind(null, slug)}
          close={closeUrgentRequest.bind(null, slug)}
        />
      )}

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
                        {a.client && (
                          <span className="self-center">
                            <Avatar name={a.client.name} src={avatarUrl(a.client.id, a.client.avatar)} size={24} />
                          </span>
                        )}
                        <Link
                          href={`/admin/${salon.slug}/musterije/${encodeURIComponent(clientKeyOf(a))}`}
                          className="font-medium hover:text-burgundy"
                        >
                          {a.guestName ?? a.client?.name ?? "Mušterija"}
                        </Link>
                        {(flags.get(clientKeyOf(a))?.noShows ?? 0) > 0 && (
                          <span className="text-[10px] uppercase tracking-wider text-burgundy">
                            {flags.get(clientKeyOf(a))?.noShows}× nije došao
                          </span>
                        )}
                        {a.source === "SALON" && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">salon</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm">
                        {a.service.name} · {formatRsd(a.price)} ·{" "}
                        <PhoneLink phone={a.guestPhone ?? a.client?.phone ?? null} />
                      </p>
                      {a.note && <p className="mt-1 text-xs italic text-neutral-500">{a.note}</p>}
                      {flags.get(clientKeyOf(a))?.note && (
                        <p className="mt-1 text-xs text-neutral-500">Beleška: {flags.get(clientKeyOf(a))?.note}</p>
                      )}
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

/** Pending urgent requests from today on, each with that day's booked appointments as swap candidates. */
async function loadUrgentRequests(salonId: string, todayIsoDate: string): Promise<UrgentRequestView[]> {
  const requests = await db.urgentRequest.findMany({
    where: { salonId, status: "PENDING", date: { gte: new Date(`${todayIsoDate}T00:00:00Z`) } },
    include: { service: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return Promise.all(
    requests.map(async (r) => {
      const dateIso = r.date.toISOString().slice(0, 10);
      const booked = await db.appointment.findMany({
        where: {
          salonId,
          status: "BOOKED",
          startTime: { gte: localToUtc(dateIso, 0, TIME_ZONE), lt: localToUtc(dateIso, 24 * 60, TIME_ZONE) },
        },
        include: { service: true, worker: true, client: { select: { name: true, phone: true } } },
        orderBy: { startTime: "asc" },
      });
      return {
        id: r.id,
        name: r.guestName,
        phone: r.guestPhone,
        serviceName: r.service.name,
        durationMinutes: r.service.durationMinutes,
        dateIso,
        dateLabel: formatDateSr(dateIso),
        reason: r.reason,
        candidates: booked.map((a) => ({
          id: a.id,
          label: `${formatLocalTime(a.startTime, TIME_ZONE)} ${a.guestName ?? a.client?.name ?? "Mušterija"} (${
            a.guestPhone ?? a.client?.phone ?? "bez telefona"
          }) · ${a.service.name} · ${a.worker.displayName}`,
        })),
      };
    }),
  );
}

function PhoneLink({ phone }: { phone: string | null }) {
  if (!phone) return <span className="text-neutral-400">bez telefona</span>;
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className="underline underline-offset-2">
      {/^\+381\d+$/.test(phone) ? formatPhone(phone) : phone}
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
