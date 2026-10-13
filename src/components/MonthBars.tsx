import { formatRsd } from "@/lib/money";
import type { MonthPoint } from "@/lib/platformStats";

const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

/** Revenue per month: solid bar = completed visits, light part = booked, not yet completed. */
export function MonthBars({ points, label }: { points: MonthPoint[]; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.bookedPara));
  return (
    <figure aria-label={label}>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label={label}>
        {points.map((p) => {
          const total = (p.bookedPara / max) * 100;
          const done = p.bookedPara > 0 ? (p.revenuePara / p.bookedPara) * 100 : 0;
          return (
            <div key={p.monthIso} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${p.monthIso}: ${formatRsd(p.revenuePara)} završeno, ${formatRsd(p.bookedPara)} sa zakazanim`}>
              <div className="flex flex-col justify-end overflow-hidden rounded-t-md bg-burgundy-soft" style={{ height: `${Math.max(total, p.bookedPara > 0 ? 2 : 0)}%` }}>
                <div className="bg-burgundy" style={{ height: `${done}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden>
        {points.map((p) => (
          <span key={p.monthIso} className="min-w-0 flex-1 text-center text-[10px] text-muted">
            {MONTHS_SHORT[Number(p.monthIso.slice(5)) - 1]}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-burgundy" aria-hidden /> završeni termini</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-burgundy-soft" aria-hidden /> zakazano, još nije završeno</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Mesec</th><th>Završeno</th><th>Sa zakazanim</th><th>Termina</th></tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.monthIso}><td>{p.monthIso}</td><td>{formatRsd(p.revenuePara)}</td><td>{formatRsd(p.bookedPara)}</td><td>{p.bookings}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
