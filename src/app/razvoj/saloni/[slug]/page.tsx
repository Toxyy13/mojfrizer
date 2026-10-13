import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeveloperShell } from "@/components/DeveloperShell";
import { MonthBars } from "@/components/MonthBars";
import { db } from "@/lib/db";
import { requireDeveloper } from "@/lib/developer";
import { formatRsd } from "@/lib/money";
import { getPlatformStats, getSalonSeries } from "@/lib/platformStats";
import { GrowthLabel } from "../../GrowthLabel";
import { sendOwnerResetLink, setSalonActive } from "../../actions";

export const metadata: Metadata = { title: "Salon · platforma · mojfrizer" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string }>;
}

export default async function DeveloperSalonPage({ params, searchParams }: PageProps) {
  const user = await requireDeveloper();
  const { slug } = await params;
  const { ok } = await searchParams;
  const salon = await db.salon.findUnique({ where: { slug }, select: { id: true, owner: { select: { name: true, email: true } } } });
  if (!salon) notFound();
  const [platform, series] = await Promise.all([getPlatformStats(), getSalonSeries(salon.id, 12)]);
  const s = platform.salons.find((x) => x.id === salon.id);
  if (!s) notFound();
  const tiles = [
    { label: "Prihod ovog meseca", value: formatRsd(s.thisMonth.bookedPara), hint: `${formatRsd(s.thisMonth.revenuePara)} završeno` },
    { label: "Rast", value: null, hint: `prošli mesec ${formatRsd(s.lastMonth.bookedPara)}` },
    { label: "Termina (30 dana)", value: String(s.bookings30d), hint: "" },
    { label: "Mušterija", value: String(s.clients), hint: "ukupno" },
    { label: "Aktivnih frizera", value: String(s.activeStaff), hint: "" },
    { label: "Poruka (30 dana)", value: String(s.messages30d), hint: "" },
    { label: "Asistent (30 dana)", value: String(s.assistant30d), hint: "pitanja" },
  ];
  return (
    <DeveloperShell user={user} active="pregled">
      <Link href="/razvoj" className="text-sm text-muted hover:text-charcoal">← Svi saloni</Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">{s.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {s.city} · /s/{s.slug} · vlasnik {salon.owner.name}{salon.owner.email ? ` (${salon.owner.email})` : ""}
            {s.isActive ? "" : " · isključen"}
          </p>
        </div>
        <Link href={`/s/${s.slug}`} className="btn-secondary btn-sm">Javna stranica ↗</Link>
      </header>
      {ok && <p className="mt-6 rounded-xl bg-forest-soft px-4 py-3 text-sm text-forest" role="status">{ok}</p>}

      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4" aria-label="Pregled salona">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white p-5">
            <p className="eyebrow">{t.label}</p>
            <p className="mt-2 font-serif text-2xl tabular-nums">{t.value ?? <GrowthLabel value={s.growthPercent} />}</p>
            {t.hint && <p className="mt-1 text-xs text-muted">{t.hint}</p>}
          </div>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="promet">
        <h2 id="promet" className="eyebrow">Promet po mesecima</h2>
        <div className="card mt-4 p-5"><MonthBars points={series} label={`Promet salona ${s.name} po mesecima`} /></div>
      </section>

      <section className="mt-12 flex flex-wrap gap-3" aria-label="Radnje">
        <form action={setSalonActive}>
          <input type="hidden" name="salonId" value={s.id} />
          <input type="hidden" name="active" value={String(!s.isActive)} />
          <button className={s.isActive ? "btn-secondary" : "btn-primary"}>{s.isActive ? "Isključi salon" : "Ponovo uključi salon"}</button>
        </form>
        <form action={sendOwnerResetLink}>
          <input type="hidden" name="salonId" value={s.id} />
          <button className="btn-secondary">Pošalji vlasniku link za novu lozinku</button>
        </form>
      </section>
      <p className="mt-3 text-xs text-muted">Isključen salon nestaje sa sajta, ne prima termine, a njegovo osoblje ne može da otvori admin.</p>
    </DeveloperShell>
  );
}
