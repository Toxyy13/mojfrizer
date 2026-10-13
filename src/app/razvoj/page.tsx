import type { Metadata } from "next";
import Link from "next/link";
import { DeveloperShell } from "@/components/DeveloperShell";
import { MonthBars } from "@/components/MonthBars";
import { requireDeveloper } from "@/lib/developer";
import { formatRsd } from "@/lib/money";
import { getPlatformStats } from "@/lib/platformStats";
import { GrowthLabel } from "./GrowthLabel";

export const metadata: Metadata = { title: "Platforma · mojfrizer" };
export const dynamic = "force-dynamic";

export default async function DeveloperHome() {
  const user = await requireDeveloper();
  const stats = await getPlatformStats();
  const tiles = [
    { label: "Saloni", value: String(stats.activeSalons), hint: stats.suspendedSalons ? `${stats.suspendedSalons} isključeno` : "svi aktivni" },
    { label: "Termina (30 dana)", value: String(stats.bookings30d), hint: "zakazano, bez otkazanih" },
    { label: "Poruka (30 dana)", value: String(stats.messages30d), hint: "chat salon–mušterija" },
    { label: "Asistent (30 dana)", value: String(stats.assistant30d), hint: "odgovorenih pitanja" },
    { label: "Naloga mušterija", value: String(stats.customerAccounts), hint: "registrovanih" },
  ];
  return (
    <DeveloperShell user={user} active="pregled">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl sm:text-4xl">Platforma</h1>
        <Link href="/razvoj/saloni/novi" className="btn-primary">Novi salon</Link>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5" aria-label="Korišćenje">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white p-5">
            <p className="eyebrow">{t.label}</p>
            <p className="mt-2 font-serif text-2xl tabular-nums">{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.hint}</p>
          </div>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="rast">
        <h2 id="rast" className="eyebrow">Promet svih salona, 12 meseci</h2>
        <div className="card mt-4 p-5"><MonthBars points={stats.series} label="Promet svih salona po mesecima" /></div>
      </section>

      <section className="mt-12" aria-labelledby="saloni">
        <h2 id="saloni" className="eyebrow">Saloni</h2>
        {stats.salons.length === 0 && <p className="mt-4 text-sm text-muted">Još nema salona.</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Salon</th>
                <th className="py-2 pr-3 text-right font-medium">Frizera</th>
                <th className="py-2 pr-3 text-right font-medium">Mušterija</th>
                <th className="py-2 pr-3 text-right font-medium">Termina 30d</th>
                <th className="py-2 pr-3 text-right font-medium">Prihod ovog meseca</th>
                <th className="py-2 text-right font-medium">Rast</th>
              </tr>
            </thead>
            <tbody>
              {stats.salons.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-3 pr-3">
                    <Link href={`/razvoj/saloni/${s.slug}`} className="link font-medium">{s.name}</Link>
                    <span className="block text-xs text-muted">{s.city}{s.isActive ? "" : " · isključen"}</span>
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{s.activeStaff}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{s.clients}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{s.bookings30d}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatRsd(s.thisMonth.bookedPara)}</td>
                  <td className="py-3 text-right tabular-nums"><GrowthLabel value={s.growthPercent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Prihod i rast računaju završene i zakazane termine; rast je u odnosu na prošli mesec.</p>
      </section>
    </DeveloperShell>
  );
}
