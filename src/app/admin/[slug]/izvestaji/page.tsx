import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Stat } from "@/components/Stat";
import { requireSalonOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { formatRating, getSalonRating, ratingCountLabel } from "@/lib/reviews";
import { formatRsd } from "@/lib/money";
import { shiftMonthIso } from "@/lib/platformStats";
import { getMonthReport, isValidMonthIso, type ReportRow } from "@/lib/reports";
import { TIME_ZONE, todayIso } from "@/lib/time";
import { servicesLabel } from "@/lib/visit";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesec?: string }>;
}

const MONTHS_SR = [
  "januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return `${MONTHS_SR[m - 1]} ${y}.`;
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export default async function ReportsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { salon, user } = await requireSalonOwner(slug);
  const current = todayIso(TIME_ZONE).slice(0, 7);
  const requested = (await searchParams).mesec ?? "";
  const monthIso = isValidMonthIso(requested) ? requested : current;
  const [r, rating, reviews] = await Promise.all([
    getMonthReport(salon.id, monthIso),
    getSalonRating(salon.id),
    db.review.findMany({
      where: { salonId: salon.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { appointment: { select: { service: { select: { name: true } }, services: { select: { service: { select: { name: true } } }, orderBy: { sortOrder: "asc" as const } }, worker: { select: { displayName: true } } } } },
    }),
  ]);

  const booked = r.byStatus.BOOKED + r.byStatus.COMPLETED + r.byStatus.NO_SHOW + r.byStatus.CANCELLED;
  const change = r.previousRevenuePara > 0 ? (r.revenuePara - r.previousRevenuePara) / r.previousRevenuePara : null;
  const maxDay = Math.max(1, ...r.byDay.map((d) => d.revenuePara));

  return (
    <AdminShell salon={salon} user={user} active="izvestaji">
      <div>
      <header>
        <h1 className="font-serif text-3xl sm:text-4xl">Izveštaji</h1>
      </header>

      <nav className="mt-8 flex items-center gap-4" aria-label="Mesec">
        <Link href={`?mesec=${shiftMonthIso(monthIso, -1)}`} aria-label="Prethodni mesec" className="btn-ghost btn-sm">
          ←
        </Link>
        <h2 className="font-serif text-3xl first-letter:uppercase">{monthLabel(monthIso)}</h2>
        {monthIso < current && (
          <Link href={`?mesec=${shiftMonthIso(monthIso, 1)}`} aria-label="Sledeći mesec" className="btn-ghost btn-sm">
            →
          </Link>
        )}
      </nav>

      <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4" aria-label="Pregled">
        <Stat
          label="Prihod"
          value={formatRsd(r.revenuePara)}
          hint={change === null ? "prošli mesec bez prihoda" : `${change >= 0 ? "+" : ""}${Math.round(change * 100)}% od prošlog meseca`}
        />
        <Stat label="Završenih termina" value={String(r.byStatus.COMPLETED)} hint={`${r.byStatus.BOOKED} još zakazano`} />
        <Stat label="Mušterija" value={String(r.uniqueClients)} hint={`${r.newClients} novih`} />
        <Stat label="Online zakazano" value={percent(r.onlineShare, 1)} hint="ostalo telefonom i u salonu" />
        <Stat label="Nije došlo" value={String(r.byStatus.NO_SHOW)} hint={`${percent(r.byStatus.NO_SHOW, booked)} svih termina`} warn={r.byStatus.NO_SHOW > 0} />
        <Stat label="Otkazano" value={String(r.byStatus.CANCELLED)} hint={`${percent(r.byStatus.CANCELLED, booked)} svih termina`} />
        <Stat
          label="Prosečan račun"
          value={r.byStatus.COMPLETED > 0 ? formatRsd(Math.round(r.revenuePara / r.byStatus.COMPLETED)) : "—"}
          hint="po završenom terminu"
        />
        <Stat label="Radnih dana sa prihodom" value={String(r.byDay.length)} hint="" />
      </section>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <Breakdown title="Po usluzi" rows={r.byService} total={r.revenuePara} />
        <Breakdown title="Po frizeru" rows={r.byWorker} total={r.revenuePara} />
      </div>

      <section className="mt-12" aria-labelledby="po-danu">
        <h2 id="po-danu" className="eyebrow">
          Prihod po danu
        </h2>
        {r.byDay.length === 0 && <p className="mt-4 text-sm text-muted">Nema završenih termina u ovom mesecu.</p>}
        <ul className="mt-4 grid gap-1.5">
          {r.byDay.map((d) => (
            <li key={d.dateIso} className="grid grid-cols-[3.5rem_1fr_7rem] items-center gap-3 text-sm">
              <span className="tabular-nums text-muted">{`${Number(d.dateIso.slice(8))}.${Number(d.dateIso.slice(5, 7))}.`}</span>
              <span className="h-3 rounded-full bg-burgundy/80" style={{ width: `${(d.revenuePara / maxDay) * 100}%` }} />
              <span className="text-right tabular-nums">{formatRsd(d.revenuePara)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="ocene">
        <h2 id="ocene" className="eyebrow">
          Ocene mušterija{rating.count > 0 ? ` · ★ ${formatRating(rating.average)} (${ratingCountLabel(rating.count)})` : ""}
        </h2>
        {reviews.length === 0 && (
          <p className="mt-4 text-sm text-muted">
            Još nema ocena. Mušterija može da oceni završen termin preko linka „Moj termin” ili iz svog naloga.
          </p>
        )}
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {reviews.map((rv) => (
            <li key={rv.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[6rem_1fr_auto] sm:items-baseline sm:gap-4">
              <span className="text-burgundy" aria-label={`${rv.rating} od 5`}>
                {"★".repeat(rv.rating)}
                <span className="text-line">{"★".repeat(5 - rv.rating)}</span>
              </span>
              <span>
                {rv.comment ? `„${rv.comment}”` : <span className="text-muted">bez komentara</span>}
                <span className="block text-xs text-muted">
                  {rv.authorName} · {servicesLabel(rv.appointment)} · {rv.appointment.worker.displayName}
                </span>
              </span>
              <span className="text-xs text-muted tabular-nums">{rv.createdAt.toLocaleDateString("sr-Latn-RS")}</span>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </AdminShell>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: ReportRow[]; total: number }) {
  return (
    <section aria-label={title}>
      <h2 className="eyebrow">{title}</h2>
      {rows.length === 0 && <p className="mt-4 text-sm text-muted">Nema podataka.</p>}
      <table className="mt-4 w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line">
              <td className="py-2.5 pr-3">{row.label}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-muted">{row.count}×</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{formatRsd(row.revenuePara)}</td>
              <td className="w-14 py-2.5 text-right tabular-nums text-muted">{percent(row.revenuePara, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
