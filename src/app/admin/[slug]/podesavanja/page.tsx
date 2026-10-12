import Link from "next/link";
import type { Service, WorkerProfile, WorkingHours } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalonOwner } from "@/lib/access";
import { formatServicePrice } from "@/lib/money";
import { TIME_ZONE, WEEKDAYS_SR, formatLocalDateIso, formatLocalTime, minutesToHHMM, todayIso } from "@/lib/time";
import {
  addDaysOff,
  addWorkerTimeOff,
  removeWorkerTimeOff,
  removeDayOff,
  saveSalonInfo,
  saveService,
  saveWorker,
  saveWorkingHours,
  toggleService,
  toggleWorker,
} from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; greska?: string }>;
}

const INPUT = "w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-charcoal focus:outline-none";
const LABEL = "block text-xs uppercase tracking-[0.15em] text-neutral-500";
const BUTTON = "bg-charcoal px-5 py-2 text-sm text-white transition-colors hover:bg-burgundy";
const LINK_BUTTON = "text-sm underline underline-offset-4 hover:text-burgundy";

export default async function SalonSettingsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { salon } = await requireSalonOwner(slug);
  const sp = await searchParams;
  const today = todayIso(TIME_ZONE);

  const [services, hours, daysOff, workers, timeOff] = await Promise.all([
    db.service.findMany({ where: { salonId: salon.id }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.workingHours.findMany({ where: { salonId: salon.id }, orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] }),
    db.salonDayOff.findMany({
      where: { salonId: salon.id, date: { gte: new Date(`${today}T00:00:00Z`) } },
      orderBy: { date: "asc" },
    }),
    db.workerProfile.findMany({ where: { salonId: salon.id }, orderBy: [{ isActive: "desc" }, { displayName: "asc" }] }),
    db.workerTimeOff.findMany({
      where: { salonId: salon.id, endTime: { gt: new Date() } },
      include: { worker: { select: { displayName: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-neutral-200 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Podešavanja</p>
          <h1 className="font-serif text-5xl">{salon.name}</h1>
        </div>
        <nav className="flex gap-6 text-sm">
          <Link href={`/admin/${salon.slug}`} className="underline underline-offset-4 hover:text-burgundy">
            ← Raspored
          </Link>
          <Link href={`/s/${salon.slug}`} className="underline underline-offset-4 hover:text-burgundy">
            Javna stranica
          </Link>
        </nav>
      </header>

      {(sp.ok || sp.greska) && (
        <p
          role="status"
          className={`mt-6 border-l-2 px-4 py-3 text-sm ${sp.greska ? "border-burgundy bg-cream text-burgundy" : "border-forest bg-cream text-forest"}`}
        >
          {sp.greska ?? sp.ok}
        </p>
      )}

      <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Odeljci">
        <a href="#usluge" className={LINK_BUTTON}>Cenovnik</a>
        <a href="#radno-vreme" className={LINK_BUTTON}>Radno vreme</a>
        <a href="#neradni-dani" className={LINK_BUTTON}>Neradni dani</a>
        <a href="#radnici" className={LINK_BUTTON}>Radnici</a>
        <a href="#odsustva" className={LINK_BUTTON}>Odsustva radnika</a>
        <a href="#salon" className={LINK_BUTTON}>Podaci o salonu</a>
      </nav>

      <Section id="usluge" title="Cenovnik" hint="Cene su u dinarima. Usluga koja se skloni ostaje u starim terminima, ali se ne može zakazati.">
        <ul className="border-t border-neutral-200">
          {services.map((s) => (
            <li key={s.id} className="border-b border-neutral-200">
              <details>
                <summary className={`flex cursor-pointer flex-wrap items-baseline gap-x-4 py-4 ${s.isActive ? "" : "text-neutral-400"}`}>
                  <span className="text-lg">{s.name}</span>
                  <span className="text-xs text-neutral-400">{s.category ?? "Ostalo"} · {s.durationMinutes} min</span>
                  <span className="ml-auto font-mono text-sm">{s.isActive ? formatServicePrice(s) : "sklonjeno"}</span>
                </summary>
                <div className="pb-6">
                  <ServiceForm slug={salon.slug} service={s} />
                  <form action={toggleService.bind(null, salon.slug)} className="mt-3">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="isActive" value={String(!s.isActive)} />
                    <button className={LINK_BUTTON}>{s.isActive ? "Skloni iz cenovnika" : "Vrati u cenovnik"}</button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="mt-8 border border-neutral-200 p-6">
          <h3 className="font-serif text-2xl">Nova usluga</h3>
          <div className="mt-4">
            <ServiceForm slug={salon.slug} service={null} nextSortOrder={services.length} />
          </div>
        </div>
      </Section>

      <Section id="radno-vreme" title="Radno vreme" hint="Pauza je opciona. Termini se ne mogu zakazati van radnog vremena.">
        <form action={saveWorkingHours.bind(null, salon.slug)}>
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <DayHoursRow key={day} day={day} ranges={hours.filter((h) => h.dayOfWeek === day)} />
            ))}
          </div>
          <button className={`${BUTTON} mt-6`}>Sačuvaj radno vreme</button>
        </form>
      </Section>

      <Section id="neradni-dani" title="Neradni dani" hint="Praznici, odmor, bolovanje. Za odmor izaberite i krajnji datum.">
        <form action={addDaysOff.bind(null, salon.slug)} className="grid gap-4 md:grid-cols-[auto_auto_1fr_auto] md:items-end">
          <label>
            <span className={LABEL}>Od</span>
            <input type="date" name="from" min={today} required className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Do (opciono)</span>
            <input type="date" name="to" min={today} className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Razlog (opciono)</span>
            <input name="reason" maxLength={120} placeholder="npr. Godišnji odmor" className={INPUT} />
          </label>
          <button className={BUTTON}>Dodaj</button>
        </form>
        <ul className="mt-6 border-t border-neutral-200">
          {daysOff.length === 0 && <li className="py-4 text-sm text-neutral-500">Nema zakazanih neradnih dana.</li>}
          {daysOff.map((d) => {
            const iso = d.date.toISOString().slice(0, 10);
            const [y, m, day] = iso.split("-");
            return (
              <li key={d.id} className="flex items-baseline gap-4 border-b border-neutral-200 py-3 text-sm">
                <span className="font-mono">{`${Number(day)}.${Number(m)}.${y}.`}</span>
                <span className="text-neutral-500">{d.reason ?? ""}</span>
                <form action={removeDayOff.bind(null, salon.slug)} className="ml-auto">
                  <input type="hidden" name="id" value={d.id} />
                  <button className={LINK_BUTTON}>Ukloni</button>
                </form>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="radnici" title="Radnici" hint="Mušterije mogu da izaberu frizera pri zakazivanju. Neaktivan radnik ne prima nove termine.">
        <ul className="border-t border-neutral-200">
          {workers.map((w) => (
            <li key={w.id} className="border-b border-neutral-200 py-4">
              <WorkerForm slug={salon.slug} worker={w} />
              <form action={toggleWorker.bind(null, salon.slug)} className="mt-2">
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="isActive" value={String(!w.isActive)} />
                <button className={LINK_BUTTON}>{w.isActive ? "Isključi (ne prima termine)" : "Ponovo uključi"}</button>
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-8 border border-neutral-200 p-6">
          <h3 className="font-serif text-2xl">Novi radnik</h3>
          <div className="mt-4">
            <WorkerForm slug={salon.slug} worker={null} />
          </div>
        </div>
      </Section>

      <Section
        id="odsustva"
        title="Odsustva radnika"
        hint="Godišnji odmor, bolovanje ili deo dana kad jedan frizer ne radi, a salon radi. Za ceo dan ostavite vreme prazno."
      >
        <form action={addWorkerTimeOff.bind(null, salon.slug)} className="grid gap-4 md:grid-cols-3">
          <label>
            <span className={LABEL}>Radnik</span>
            <select name="workerId" required className={INPUT}>
              {workers
                .filter((w) => w.isActive)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Od datuma</span>
            <input type="date" name="from" min={today} required className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Do datuma (opciono)</span>
            <input type="date" name="to" min={today} className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Od (opciono)</span>
            <input type="time" name="fromTime" className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Do (opciono)</span>
            <input type="time" name="toTime" className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Razlog (opciono)</span>
            <input name="reason" maxLength={120} placeholder="npr. Bolovanje" className={INPUT} />
          </label>
          <div className="md:col-span-3">
            <button className={BUTTON}>Dodaj odsustvo</button>
          </div>
        </form>
        <ul className="mt-6 border-t border-neutral-200">
          {timeOff.length === 0 && <li className="py-4 text-sm text-neutral-500">Nema zakazanih odsustva.</li>}
          {timeOff.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 border-b border-neutral-200 py-3 text-sm">
              <span className="font-medium">{t.worker.displayName}</span>
              <span className="font-mono">{describeRange(t.startTime, t.endTime)}</span>
              <span className="text-neutral-500">{t.reason ?? ""}</span>
              <form action={removeWorkerTimeOff.bind(null, salon.slug)} className="ml-auto">
                <input type="hidden" name="id" value={t.id} />
                <button className={LINK_BUTTON}>Ukloni</button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="salon" title="Podaci o salonu" hint="Prikazuju se na javnoj stranici salona.">
        <form action={saveSalonInfo.bind(null, salon.slug)} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={LABEL}>Naziv</span>
            <input name="name" defaultValue={salon.name} required maxLength={80} className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Telefon salona</span>
            <input name="phone" type="tel" defaultValue={salon.phone ?? ""} placeholder="018 123 456" className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Adresa</span>
            <input name="address" defaultValue={salon.address} required maxLength={120} className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Grad</span>
            <input name="city" defaultValue={salon.city} required maxLength={60} className={INPUT} />
          </label>
          <label className="md:col-span-2">
            <span className={LABEL}>Opis (opciono)</span>
            <textarea name="description" defaultValue={salon.description ?? ""} rows={3} maxLength={1000} className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Razmak između termina</span>
            <select name="slotStepMinutes" defaultValue={String(salon.slotStepMinutes)} className={INPUT}>
              {[5, 10, 15, 20, 30, 60].map((v) => (
                <option key={v} value={v}>
                  na {v} min
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Mušterija otkazuje ili pomera najkasnije</span>
            <select name="cancelCutoffHours" defaultValue={String(salon.cancelCutoffHours)} className={INPUT}>
              {[0, 1, 2, 3, 6, 12, 24, 48].map((v) => (
                <option key={v} value={v}>
                  {v === 0 ? "do samog početka" : `${v} h pre termina`}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button className={BUTTON}>Sačuvaj podatke</button>
          </div>
        </form>
      </Section>
    </main>
  );
}

function Section(props: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={props.id} className="mt-16 scroll-mt-6" aria-labelledby={`${props.id}-naslov`}>
      <h2 id={`${props.id}-naslov`} className="font-serif text-4xl">
        {props.title}
      </h2>
      <p className="mt-1 mb-6 text-sm text-neutral-500">{props.hint}</p>
      {props.children}
    </section>
  );
}

function ServiceForm({ slug, service, nextSortOrder = 0 }: { slug: string; service: Service | null; nextSortOrder?: number }) {
  const rsd = (para: number | null | undefined): string => (para === null || para === undefined ? "" : String(para / 100));
  return (
    <form action={saveService.bind(null, slug)} className="grid gap-4 md:grid-cols-6">
      {service && <input type="hidden" name="id" value={service.id} />}
      <label className="md:col-span-3">
        <span className={LABEL}>Naziv</span>
        <input name="name" defaultValue={service?.name ?? ""} required maxLength={80} className={INPUT} />
      </label>
      <label className="md:col-span-2">
        <span className={LABEL}>Kategorija</span>
        <input name="category" defaultValue={service?.category ?? ""} maxLength={40} placeholder="npr. Šišanje" className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Redosled</span>
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={service?.sortOrder ?? nextSortOrder} className={INPUT} />
      </label>
      <label className="md:col-span-2">
        <span className={LABEL}>Cena (RSD)</span>
        <input name="priceRsd" type="number" min={0} step={1} defaultValue={rsd(service?.price)} required className={INPUT} />
      </label>
      <label className="md:col-span-2">
        <span className={LABEL}>Cena uz drugu uslugu</span>
        <input
          name="comboPriceRsd"
          type="number"
          min={0}
          step={1}
          defaultValue={rsd(service?.comboPrice)}
          placeholder="ista (0 = gratis)"
          className={INPUT}
        />
      </label>
      <label className="md:col-span-2">
        <span className={LABEL}>Trajanje (min)</span>
        <input
          name="durationMinutes"
          type="number"
          min={5}
          max={480}
          step={5}
          defaultValue={service?.durationMinutes ?? 30}
          required
          className={INPUT}
        />
      </label>
      <label className="md:col-span-6">
        <span className={LABEL}>Opis (opciono)</span>
        <input name="description" defaultValue={service?.description ?? ""} maxLength={300} className={INPUT} />
      </label>
      <div className="md:col-span-6">
        <button className={BUTTON}>{service ? "Sačuvaj izmene" : "Dodaj uslugu"}</button>
      </div>
    </form>
  );
}

function DayHoursRow({ day, ranges }: { day: number; ranges: WorkingHours[] }) {
  const open = ranges.length > 0;
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  // Two ranges on one day are shown as one shift with a break.
  const hasBreak = ranges.length >= 2;
  const time = (m: number | undefined, fallback: string): string => (m === undefined ? fallback : minutesToHHMM(m));
  return (
    <fieldset className="grid grid-cols-2 items-end gap-3 border-b border-neutral-200 pb-3 md:grid-cols-[9rem_repeat(4,minmax(0,1fr))]">
      <label className="col-span-2 flex items-center gap-2 md:col-span-1">
        <input type="checkbox" name={`open-${day}`} defaultChecked={open} />
        <span>{WEEKDAYS_SR[day]}</span>
      </label>
      <label>
        <span className={LABEL}>Od</span>
        <input type="time" name={`from-${day}`} defaultValue={time(first?.opensAt, "09:00")} className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Do</span>
        <input type="time" name={`to-${day}`} defaultValue={time(last?.closesAt, "17:00")} className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Pauza od</span>
        <input type="time" name={`breakFrom-${day}`} defaultValue={hasBreak ? minutesToHHMM(first.closesAt) : ""} className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Pauza do</span>
        <input type="time" name={`breakTo-${day}`} defaultValue={hasBreak ? minutesToHHMM(ranges[1].opensAt) : ""} className={INPUT} />
      </label>
    </fieldset>
  );
}

function WorkerForm({ slug, worker }: { slug: string; worker: WorkerProfile | null }) {
  return (
    <form action={saveWorker.bind(null, slug)} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
      {worker && <input type="hidden" name="id" value={worker.id} />}
      <label>
        <span className={LABEL}>Ime {worker && !worker.isActive ? "(isključen)" : ""}</span>
        <input name="displayName" defaultValue={worker?.displayName ?? ""} required maxLength={60} className={INPUT} />
      </label>
      <label>
        <span className={LABEL}>Specijalnosti, odvojene zarezom</span>
        <input
          name="specialities"
          defaultValue={worker?.specialities.join(", ") ?? ""}
          placeholder="npr. muško šišanje, brijanje"
          className={INPUT}
        />
      </label>
      <button className={BUTTON}>{worker ? "Sačuvaj" : "Dodaj radnika"}</button>
    </form>
  );
}

function shortDateIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.${y}.`;
}

/** "12.10.2026. 13:00–15:00" for part of a day, "12.10.2026. – 14.10.2026." for whole days. */
function describeRange(start: Date, end: Date): string {
  const startDay = formatLocalDateIso(start, TIME_ZONE);
  const startTime = formatLocalTime(start, TIME_ZONE);
  const endTime = formatLocalTime(end, TIME_ZONE);
  if (startTime === "00:00" && endTime === "00:00") {
    const lastDay = formatLocalDateIso(new Date(end.getTime() - 3_600_000), TIME_ZONE);
    return lastDay === startDay ? shortDateIso(startDay) : `${shortDateIso(startDay)} – ${shortDateIso(lastDay)}`;
  }
  return `${shortDateIso(startDay)} ${startTime}–${endTime}`;
}
