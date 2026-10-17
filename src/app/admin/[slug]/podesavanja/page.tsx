import { AdminShell } from "@/components/AdminShell";
import type { Service, WorkerProfile, WorkingHours } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalonOwner } from "@/lib/access";
import { SOCIAL_LABELS, SOCIAL_NETWORKS } from "@/lib/socialLinks";
import { formatServicePrice } from "@/lib/money";
import { TIME_ZONE, WEEKDAYS_SR, formatLocalDateIso, formatLocalTime, minutesToHHMM, todayIso } from "@/lib/time";
import {
  addDaysOff,
  addWorkerBreak,
  addWorkerTimeOff,
  createWorkerLogin,
  removeWorkerLogin,
  removeWorkerBreak,
  removeWorkerTimeOff,
  removeDayOff,
  removeServiceCombo,
  saveSalonInfo,
  saveVisibility,
  saveService,
  saveServiceCombo,
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

const INPUT = "field py-2.5 text-sm";
const LABEL = "field-label block";
const BUTTON = "btn-primary";
const LINK_BUTTON = "link text-sm text-muted";

export default async function SalonSettingsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { salon, user } = await requireSalonOwner(slug);
  const sp = await searchParams;
  const today = todayIso(TIME_ZONE);

  const [services, hours, daysOff, workers, timeOff, combos, breaks] = await Promise.all([
    db.service.findMany({ where: { salonId: salon.id }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.workingHours.findMany({ where: { salonId: salon.id }, orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] }),
    db.salonDayOff.findMany({
      where: { salonId: salon.id, date: { gte: new Date(`${today}T00:00:00Z`) } },
      orderBy: { date: "asc" },
    }),
    db.workerProfile.findMany({
      where: { salonId: salon.id },
      include: { user: { select: { email: true } } },
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    }),
    db.workerTimeOff.findMany({
      where: { salonId: salon.id, endTime: { gt: new Date() } },
      include: { worker: { select: { displayName: true } } },
      orderBy: { startTime: "asc" },
    }),
    db.serviceCombo.findMany({ where: { salonId: salon.id }, orderBy: { createdAt: "asc" } }),
    db.workerBreak.findMany({
      where: { salonId: salon.id, OR: [{ date: null }, { date: { gte: new Date(`${today}T00:00:00Z`) } }] },
      include: { worker: { select: { displayName: true } } },
      orderBy: [{ startMinute: "asc" }],
    }),
  ]);
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const activeServices = services.filter((s) => s.isActive);
  const workerOptions = workers
    .filter((w) => w.isActive)
    .map((w) => (
      <option key={w.id} value={w.id}>
        {w.displayName}
      </option>
    ));

  return (
    <AdminShell salon={salon} user={user} active="podesavanja">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-36 lg:flex-col lg:self-start" aria-label="Odeljci">
        <h1 className="eyebrow mb-2 hidden px-3 lg:block">Podešavanja</h1>
        {[
          ["#usluge", "Cenovnik"],
          ["#kombinacije", "Više usluga"],
          ["#radno-vreme", "Radno vreme"],
          ["#neradni-dani", "Neradni dani"],
          ["#radnici", "Radnici"],
          ["#pauze", "Pauze radnika"],
          ["#odsustva", "Odsustva radnika"],
          ["#salon", "Podaci o salonu"],
          ["#vidljivost", "Javni ili privatni salon"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="btn-ghost btn-sm shrink-0 justify-start">
            {label}
          </a>
        ))}
      </nav>
      <div className="grid min-w-0 gap-6">
      {(sp.ok || sp.greska) && (
        <p role="status" className={sp.greska ? "alert-error" : "rounded-xl bg-forest-soft px-4 py-3 text-sm text-forest"}>
          {sp.greska ?? sp.ok}
        </p>
      )}

      <Section id="usluge" title="Cenovnik" hint="Cene su u dinarima. Usluga koja se skloni ostaje u starim terminima, ali se ne može zakazati.">
        <ul className="divide-y divide-line border-y border-line">
          {services.map((s) => (
            <li key={s.id}>
              <details>
                <summary className={`flex cursor-pointer flex-wrap items-baseline gap-x-4 rounded-lg px-2 py-4 hover:bg-cream ${s.isActive ? "" : "text-muted line-through"}`}>
                  <span className="text-lg">{s.name}</span>
                  <span className="text-xs text-muted">{s.category ?? "Ostalo"} · {s.durationMinutes} min</span>
                  <span className="ml-auto text-sm font-medium tabular-nums">{s.isActive ? formatServicePrice(s) : "sklonjeno"}</span>
                </summary>
                <div className="px-2 pb-6">
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
        <div className="mt-6 rounded-2xl bg-cream p-5">
          <h3 className="font-serif text-2xl">Nova usluga</h3>
          <div className="mt-4">
            <ServiceForm slug={salon.slug} service={null} nextSortOrder={services.length} />
          </div>
        </div>
      </Section>

      <Section
        id="kombinacije"
        title="Više usluga u jednom terminu"
        hint="Mušterija može da izabere više usluga odjednom. Ako ovde nema te kombinacije, termin traje koliko i zbir usluga."
      >
        {combos.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {combos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-3">
                <span className="min-w-0 flex-1">{c.serviceIds.map((id) => serviceName.get(id) ?? "obrisana usluga").join(" + ")}</span>
                <span className="text-sm font-medium tabular-nums">{c.durationMinutes} min</span>
                <form action={removeServiceCombo.bind(null, salon.slug)}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className={LINK_BUTTON}>Obriši</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={saveServiceCombo.bind(null, salon.slug)} className="mt-6 rounded-2xl bg-cream p-5">
          <h3 className="font-serif text-2xl">Nova kombinacija</h3>
          <fieldset className="mt-4 min-w-0">
            <legend className={LABEL}>Usluge (bar dve)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeServices.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-burgundy has-[:checked]:bg-burgundy-soft">
                  <input type="checkbox" name="serviceIds" value={s.id} className="accent-burgundy" />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label>
              <span className={LABEL}>Ukupno traje (min)</span>
              <input name="durationMinutes" type="number" min={5} max={480} step={5} defaultValue={30} required className={`${INPUT} w-32`} />
            </label>
            <button className={BUTTON}>Sačuvaj kombinaciju</button>
          </div>
          <p className="mt-3 text-xs text-muted">Ista kombinacija se ne duplira: novo trajanje zamenjuje staro.</p>
        </form>
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
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {daysOff.length === 0 && <li className="py-4 text-sm text-muted">Nema zakazanih neradnih dana.</li>}
          {daysOff.map((d) => (
            <li key={d.id} className="flex items-baseline gap-4 py-3 text-sm">
              <span className="font-medium tabular-nums">{shortDateIso(d.date.toISOString().slice(0, 10))}</span>
              <span className="text-muted">{d.reason ?? ""}</span>
              <RemoveForm action={removeDayOff.bind(null, salon.slug)} id={d.id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="radnici" title="Radnici" hint="Mušterije mogu da izaberu frizera pri zakazivanju. Svaki radnik može imati svoj nalog koji vidi samo njegov raspored. Neaktivan radnik ne prima nove termine.">
        <ul className="divide-y divide-line border-y border-line">
          {workers.map((w) => (
            <li key={w.id} className="py-4">
              <WorkerForm slug={salon.slug} worker={w} />
              <WorkerLogin slug={salon.slug} worker={w} isOwner={w.userId === salon.ownerId} />
              <form action={toggleWorker.bind(null, salon.slug)} className="mt-2">
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="isActive" value={String(!w.isActive)} />
                <button className={LINK_BUTTON}>{w.isActive ? "Isključi (ne prima termine)" : "Ponovo uključi"}</button>
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-2xl bg-cream p-5">
          <h3 className="font-serif text-2xl">Novi radnik</h3>
          <div className="mt-4">
            <WorkerForm slug={salon.slug} worker={null} />
          </div>
        </div>
      </Section>

      <Section
        id="pauze"
        title="Pauze radnika"
        hint="Ručak, kafa ili druga pauza usred radnog dana. Mušterije ne mogu da zakažu termin koji bi pao u pauzu. Važi i za vas kao vlasnika."
      >
        <form action={addWorkerBreak.bind(null, salon.slug)} className="grid gap-4 md:grid-cols-3">
          <label>
            <span className={LABEL}>Radnik</span>
            <select name="workerId" required className={INPUT}>
              {workerOptions}
            </select>
          </label>
          <label>
            <span className={LABEL}>Od</span>
            <input type="time" name="fromTime" required className={INPUT} />
          </label>
          <label>
            <span className={LABEL}>Do</span>
            <input type="time" name="toTime" required className={INPUT} />
          </label>
          <fieldset className="md:col-span-3">
            <legend className={LABEL}>Ponavlja se svake nedelje</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAYS_SR.slice(1).map((name, i) => (
                <label key={name} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">
                  <input type="checkbox" name="weekdays" value={i + 1} />
                  {name.slice(0, 3)}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className={LABEL}>ili samo za jedan datum</span>
            <input type="date" name="date" min={today} className={INPUT} />
          </label>
          <label className="md:col-span-2">
            <span className={LABEL}>Naziv (opciono)</span>
            <input name="label" maxLength={60} placeholder="npr. Ručak" className={INPUT} />
          </label>
          <div className="md:col-span-3">
            <button className={BUTTON}>Dodaj pauzu</button>
          </div>
        </form>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {breaks.length === 0 && <li className="py-4 text-sm text-muted">Nema pauza.</li>}
          {breaks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-baseline gap-x-4 py-3 text-sm">
              <span className="font-medium">{b.worker.displayName}</span>
              <span className="tabular-nums">
                {minutesToHHMM(b.startMinute)}–{minutesToHHMM(b.endMinute)}
              </span>
              <span className="text-muted">
                {b.date ? shortDateIso(b.date.toISOString().slice(0, 10)) : b.weekdays.map((d) => WEEKDAYS_SR[d]?.slice(0, 3)).join(", ")}
                {b.label ? ` · ${b.label}` : ""}
              </span>
              <RemoveForm action={removeWorkerBreak.bind(null, salon.slug)} id={b.id} />
            </li>
          ))}
        </ul>
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
              {workerOptions}
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
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {timeOff.length === 0 && <li className="py-4 text-sm text-muted">Nema zakazanih odsustva.</li>}
          {timeOff.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 py-3 text-sm">
              <span className="font-medium">{t.worker.displayName}</span>
              <span className="font-mono">{describeRange(t.startTime, t.endTime)}</span>
              <span className="text-muted">{t.reason ?? ""}</span>
              <RemoveForm action={removeWorkerTimeOff.bind(null, salon.slug)} id={t.id} />
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
          {SOCIAL_NETWORKS.map((network) => (
            <label key={network}>
              <span className={LABEL}>{SOCIAL_LABELS[network]} (opciono)</span>
              <input
                name={network}
                defaultValue={salon[`${network}Url` as const] ?? ""}
                placeholder="@korisnicko_ime ili link"
                maxLength={200}
                autoCapitalize="none"
                autoCorrect="off"
                className={INPUT}
              />
            </label>
          ))}
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
          <label className="md:col-span-2">
            <span className={LABEL}>Doplata za hitne termine (RSD)</span>
            <input
              name="urgentSurchargeRsd"
              type="number"
              min={0}
              max={100000}
              step={10}
              defaultValue={salon.urgentSurcharge / 100}
              className={INPUT}
            />
            <span className="mt-1 block text-xs text-muted">
              Hitan termin je skuplji za ovaj iznos po poseti, na cenu izabranih usluga. Mušterija to vidi pre slanja
              zahteva. 0 = bez doplate.
            </span>
          </label>
          <div className="md:col-span-2">
            <button className={BUTTON}>Sačuvaj podatke</button>
          </div>
        </form>
      </Section>

      <Section
        id="vidljivost"
        title="Javni ili privatni salon"
        hint="Odlučuje ko sme da vidi i otvori vaš salon na platformi."
      >
        <form action={saveVisibility.bind(null, salon.slug)} className="grid gap-3">
          <label className="card flex cursor-pointer items-start gap-3 p-4">
            <input type="radio" name="visibility" value="PUBLIC" defaultChecked={salon.visibility === "PUBLIC"} className="mt-1" />
            <span>
              <span className="block font-medium">Javni salon</span>
              <span className="block text-sm text-muted">
                Svako ga može pronaći u pretrazi i otvoriti, i zakazati termin. Preporučeno za većinu salona.
              </span>
            </span>
          </label>
          <label className="card flex cursor-pointer items-start gap-3 p-4">
            <input type="radio" name="visibility" value="PRIVATE" defaultChecked={salon.visibility === "PRIVATE"} className="mt-1" />
            <span>
              <span className="block font-medium">Privatni salon</span>
              <span className="block text-sm text-muted">
                Ne pojavljuje se u pretrazi ni na spisku salona. Vide ga samo ulogovane mušterije koje su skenirale
                vaš QR kod (stranica „QR kod”) i vaše osoblje. Ostali dobijaju poruku da stranica ne postoji.
              </span>
            </span>
          </label>
          <div>
            <button className={BUTTON}>Sačuvaj</button>
          </div>
        </form>
      </Section>
      </div>
      </div>
    </AdminShell>
  );
}

function RemoveForm({ action, id }: { action: (formData: FormData) => Promise<void>; id: string }) {
  return (
    <form action={action} className="ml-auto">
      <input type="hidden" name="id" value={id} />
      <button className={LINK_BUTTON}>Ukloni</button>
    </form>
  );
}

function Section(props: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={props.id} className="card scroll-mt-36 p-5 sm:p-7" aria-labelledby={`${props.id}-naslov`}>
      <h2 id={`${props.id}-naslov`} className="font-serif text-3xl">
        {props.title}
      </h2>
      <p className="mt-1 mb-6 text-sm text-muted">{props.hint}</p>
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
    <fieldset className="grid grid-cols-2 items-end gap-3 border-b border-line pb-4 md:grid-cols-[9rem_repeat(4,minmax(0,1fr))]">
      <label className="col-span-2 flex items-center gap-2 md:col-span-1">
        <input type="checkbox" name={`open-${day}`} defaultChecked={open} className="size-5 accent-burgundy" />
        <span className="font-medium">{WEEKDAYS_SR[day]}</span>
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

function WorkerLogin({
  slug,
  worker,
  isOwner,
}: {
  slug: string;
  worker: WorkerProfile & { user: { email: string | null } | null };
  isOwner: boolean;
}) {
  if (isOwner) return <p className="mt-2 text-sm text-muted">Ovo je nalog vlasnika salona.</p>;
  if (worker.userId) {
    return (
      <form action={removeWorkerLogin.bind(null, slug)} className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <input type="hidden" name="workerId" value={worker.id} />
        <span className="text-muted">Nalog: {worker.user?.email ?? "bez emaila"} (vidi samo svoj raspored)</span>
        <button className={LINK_BUTTON}>Ukloni nalog</button>
      </form>
    );
  }
  return (
    <form action={createWorkerLogin.bind(null, slug)} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <input type="hidden" name="workerId" value={worker.id} />
      <label className="block">
        <span className={LABEL}>Email za nalog radnika</span>
        <input name="email" type="email" required autoComplete="off" className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Lozinka (bar 8 znakova)</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={INPUT} />
      </label>
      <button className={BUTTON}>Napravi nalog</button>
    </form>
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
