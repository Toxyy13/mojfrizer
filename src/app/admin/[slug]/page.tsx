import Link from "next/link";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { Avatar } from "@/components/Avatar";
import { avatarUrl } from "@/lib/avatar";
import { requireSalonAccess } from "@/lib/access";
import { clientFlags, clientKeyOf } from "@/lib/clients";
import { getRevenue } from "@/lib/revenue";
import { formatRsd } from "@/lib/money";
import { TIME_ZONE, addDaysIso, formatDateSr, formatLocalTime, isValidDateIso, localToUtc, todayIso } from "@/lib/time";
import { toBookingServices, toBookingWorkers, upcomingDays } from "@/lib/salonView";
import { BookingForm } from "@/components/BookingForm";
import { AdminShell } from "@/components/AdminShell";
import { bookForClient, closeUrgentRequest, setAppointmentStatus, swapForUrgent } from "./actions";
import { UrgentRequests, type UrgentRequestView } from "./UrgentRequests";
import { appointmentServicesInclude, resolveVisit, servicesLabel } from "@/lib/visit";

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

const STATUS_STYLE: Record<AppointmentStatus, { row: string; badge: string }> = {
  BOOKED: { row: "border-l-burgundy", badge: "bg-burgundy-soft text-burgundy" },
  COMPLETED: { row: "border-l-forest", badge: "bg-forest-soft text-forest" },
  CANCELLED: { row: "border-l-line opacity-60", badge: "bg-sand text-muted" },
  NO_SHOW: { row: "border-l-line opacity-75", badge: "bg-sand text-muted" },
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

  const [workers, services, combos, hours, daysOff, appointments, dayRevenue, monthRevenue] = await Promise.all([
    db.workerProfile.findMany({ where: { salonId: salon.id, isActive: true }, orderBy: { displayName: "asc" } }),
    db.service.findMany({ where: { salonId: salon.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.serviceCombo.findMany({ where: { salonId: salon.id }, select: { serviceIds: true, durationMinutes: true } }),
    db.workingHours.findMany({ where: { salonId: salon.id } }),
    db.salonDayOff.findMany({ where: { salonId: salon.id, date: { gte: new Date(`${dateIso}T00:00:00Z`) } } }),
    db.appointment.findMany({
      where: { salonId: salon.id, startTime: { gte: dayStart, lt: dayEnd } },
      include: { service: true, ...appointmentServicesInclude, client: { select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } } } },
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
  const activeCount = appointments.filter((a) => a.status === "BOOKED").length;
  const [flags, timeOff] = await Promise.all([
    clientFlags(salon.id, appointments.map(clientKeyOf)),
    db.workerTimeOff.findMany({
      where: { salonId: salon.id, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return (
    <AdminShell salon={salon} user={user} active="raspored">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Pregled">
        <div className="card col-span-2 p-5">
          <div className="flex items-center gap-2">
            <Link href={`?date=${addDaysIso(dateIso, -1)}`} aria-label="Prethodni dan" className="btn-secondary btn-sm size-9 p-0">
              ←
            </Link>
            <Link href={`?date=${addDaysIso(dateIso, 1)}`} aria-label="Sledeći dan" className="btn-secondary btn-sm size-9 p-0">
              →
            </Link>
            {dateIso !== today && (
              <Link href="?" className="btn-ghost btn-sm">
                Danas
              </Link>
            )}
          </div>
          <h1 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">{formatDateSr(dateIso)}</h1>
          <p className="mt-1 text-sm text-muted">
            {activeCount} {activeCount === 1 ? "zakazan termin" : "zakazanih termina"}
          </p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Pazar za dan</p>
          <p className="mt-3 font-serif text-2xl tabular-nums sm:text-3xl">{formatRsd(dayRevenue.totalPara)}</p>
          <p className="mt-1 text-xs text-muted">{dayRevenue.completedCount} završenih</p>
        </div>
        <div className="card bg-charcoal p-5 text-white">
          <p className="eyebrow text-white/60">Pazar za mesec</p>
          <p className="mt-3 font-serif text-2xl tabular-nums sm:text-3xl">{formatRsd(monthRevenue.totalPara)}</p>
          <p className="mt-1 text-xs text-white/60">{monthRevenue.completedCount} završenih</p>
        </div>
      </section>

      {urgentRequests.length > 0 && (
        <UrgentRequests
          requests={urgentRequests}
          swap={swapForUrgent.bind(null, slug)}
          close={closeUrgentRequest.bind(null, slug)}
        />
      )}

      <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className={`grid min-w-0 content-start gap-6 ${workers.length > 1 ? "md:grid-cols-2" : ""}`}>
          {workers.map((w) => {
            const list = appointments.filter((a) => a.workerId === w.id);
            return (
              <article key={w.id} aria-label={`Termini: ${w.displayName}`} className="min-w-0">
                <h2 className="flex items-center justify-between border-b border-line pb-3">
                  <span className="font-serif text-2xl">{w.displayName}</span>
                  <span className="text-sm text-muted">{list.filter((a) => a.status === "BOOKED").length} termina</span>
                </h2>
                {timeOff
                  .filter((t) => t.workerId === w.id)
                  .map((t) => (
                    <p key={t.id} className="mt-4 rounded-2xl border border-dashed border-line bg-sand px-4 py-3 text-sm text-muted">
                      Odsustvo{" "}
                      {t.startTime <= dayStart && t.endTime >= dayEnd
                        ? "ceo dan"
                        : `${formatLocalTime(t.startTime < dayStart ? dayStart : t.startTime, TIME_ZONE)}–${
                            t.endTime >= dayEnd ? "24:00" : formatLocalTime(t.endTime, TIME_ZONE)
                          }`}
                      {t.reason ? ` · ${t.reason}` : ""}
                    </p>
                  ))}
                {list.length === 0 && (
                  <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                    Nema termina za ovaj dan.
                  </p>
                )}
                <ol className="mt-4 grid gap-2">
                  {list.map((a) => (
                    <li key={a.id} className={`card border-l-4 p-4 ${STATUS_STYLE[a.status].row}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-14 shrink-0">
                          <p className="font-serif text-xl leading-none tabular-nums">{formatLocalTime(a.startTime, TIME_ZONE)}</p>
                          <p className="mt-1 text-xs text-muted tabular-nums">do {formatLocalTime(a.endTime, TIME_ZONE)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {a.client && <Avatar name={a.client.name} src={avatarUrl(a.client.id, a.client.avatar)} size={24} />}
                            <Link
                              href={`/admin/${salon.slug}/musterije/${encodeURIComponent(clientKeyOf(a))}`}
                              className={`font-medium hover:text-burgundy ${a.status === "CANCELLED" ? "line-through" : ""}`}
                            >
                              {a.guestName ?? a.client?.name ?? "Mušterija"}
                            </Link>
                            {(flags.get(clientKeyOf(a))?.noShows ?? 0) > 0 && (
                              <span className="badge bg-burgundy text-white">{flags.get(clientKeyOf(a))?.noShows}× nije došao</span>
                            )}
                            {a.source === "SALON" && <span className="badge bg-sand text-muted">upisao salon</span>}
                            <span className={`badge ml-auto ${STATUS_STYLE[a.status].badge}`}>{STATUS_LABEL[a.status]}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {servicesLabel(a)} · {formatRsd(a.price)} · <PhoneLink phone={a.guestPhone ?? a.client?.phone ?? null} />
                          </p>
                          {a.note && <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs text-muted">„{a.note}”</p>}
                          {flags.get(clientKeyOf(a))?.note && (
                            <p className="mt-2 text-xs text-muted">Beleška: {flags.get(clientKeyOf(a))?.note}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {a.status === "BOOKED" ? (
                              <>
                                <StatusButton action={statusAction} id={a.id} status="COMPLETED" label="✓ Završeno" primary />
                                <StatusButton action={statusAction} id={a.id} status="NO_SHOW" label="Nije došao" />
                                <StatusButton action={statusAction} id={a.id} status="CANCELLED" label="Otkaži" />
                              </>
                            ) : (
                              <StatusButton action={statusAction} id={a.id} status="BOOKED" label="Vrati na zakazano" />
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>

        <aside className="card min-w-0 p-5 sm:p-6 lg:sticky lg:top-32 lg:self-start" aria-labelledby="novi-termin">
          <h2 id="novi-termin" className="font-serif text-2xl">
            Upiši termin
          </h2>
          <p className="mt-1 text-sm text-muted">Za mušterije koje zovu telefonom ili dođu u salon.</p>
          <div className="mt-6">
            <BookingForm
              key={dateIso}
              slug={salon.slug}
              mode="salon"
              services={toBookingServices(services)}
              combos={combos}
              workers={toBookingWorkers(workers)}
              days={upcomingDays(hours, daysOff, 21, dateIso)}
              submit={bookForClient.bind(null, salon.slug)}
            />
          </div>
        </aside>
      </section>
    </AdminShell>
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
      const visit = await resolveVisit(salonId, r.serviceIds.length > 0 ? r.serviceIds : [r.serviceId]);
      const names = visit ? visit.services.map((s) => s.name).join(" + ") : r.service.name;
      const durationMinutes = visit?.durationMinutes ?? r.service.durationMinutes;
      const booked = await db.appointment.findMany({
        where: {
          salonId,
          status: "BOOKED",
          startTime: { gte: localToUtc(dateIso, 0, TIME_ZONE), lt: localToUtc(dateIso, 24 * 60, TIME_ZONE) },
        },
        include: { service: true, ...appointmentServicesInclude, worker: true, client: { select: { name: true, phone: true } } },
        orderBy: { startTime: "asc" },
      });
      return {
        id: r.id,
        name: r.guestName,
        phone: r.guestPhone,
        serviceName: names,
        durationMinutes,
        dateIso,
        dateLabel: formatDateSr(dateIso),
        reason: r.reason,
        candidates: booked.map((a) => ({
          id: a.id,
          label: `${formatLocalTime(a.startTime, TIME_ZONE)} ${a.guestName ?? a.client?.name ?? "Mušterija"} (${
            a.guestPhone ?? a.client?.phone ?? "bez telefona"
          }) · ${servicesLabel(a)} · ${a.worker.displayName}`,
        })),
      };
    }),
  );
}

function PhoneLink({ phone }: { phone: string | null }) {
  if (!phone) return <span>bez telefona</span>;
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className="link">
      {/^\+381\d+$/.test(phone) ? formatPhone(phone) : phone}
    </a>
  );
}

function StatusButton(props: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  status: AppointmentStatus;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={props.action}>
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="status" value={props.status} />
      <button className={`btn-sm ${props.primary ? "btn-primary" : "btn-secondary"}`}>{props.label}</button>
    </form>
  );
}
