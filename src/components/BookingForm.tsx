"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type React from "react";
import type { BookingResult } from "@/lib/booking";
import type { SlotsResponse } from "@/app/api/salons/[slug]/slots/route";
import { formatPrice, formatRsd } from "@/lib/money";

export interface BookingService {
  id: string;
  name: string;
  category: string;
  priceLabel: string;
  durationMin: number;
  price: number; // para
  comboPrice: number | null; // para, when booked together with another service
}

/** Salon-defined length for an exact set of services; other sets take the sum. */
export interface BookingCombo {
  serviceIds: string[];
  durationMinutes: number;
}

export interface BookingWorker {
  id: string;
  name: string;
}

export interface BookingFormValues {
  serviceIds: string[];
  workerId: string | null;
  dateIso: string;
  minute: number;
  clientName: string;
  clientPhone: string;
  note: string | null;
}

export interface UrgentFormValues {
  serviceIds: string[];
  dateIso: string;
  clientName: string;
  clientPhone: string;
  reason: string;
}

export type UrgentResult = { ok: true } | { ok: false; error: string };

interface BookingFormProps {
  slug: string;
  services: BookingService[];
  combos?: BookingCombo[];
  workers: BookingWorker[];
  days: Array<{ iso: string; label: string; closed: boolean }>;
  mode: "public" | "salon";
  submit: (values: BookingFormValues) => Promise<BookingResult>;
  /** Prefills name and phone for a logged-in customer. */
  initialClient?: { name: string; phone: string };
  // When set, a fully booked day offers an urgent request the salon reviews by hand.
  requestUrgent?: (values: UrgentFormValues) => Promise<UrgentResult>;
  // Extra charge for an urgent appointment, in para (0 = none); shown before the request is sent.
  urgentSurcharge?: number;
  // When set, a fully booked day lets a logged-in customer wait for a freed slot (error "login" = not logged in).
  joinWaitlist?: (serviceIds: string[], dateIso: string) => Promise<UrgentResult>;
  /** Preselects services and a hairdresser, e.g. for "book again". Ignored when not offered. */
  initialServiceIds?: string[];
  initialWorkerId?: string;
}

/** Same rules as the server (src/lib/visit.ts), for the live summary only; the server decides. */
function visitSummary(chosen: BookingService[], combos: BookingCombo[]): { minutes: number; price: number } {
  const ids = chosen.map((s) => s.id).sort();
  const combo =
    ids.length > 1
      ? combos.find((c) => c.serviceIds.length === ids.length && [...c.serviceIds].sort().every((id, i) => id === ids[i]))
      : undefined;
  const minutes = combo?.durationMinutes ?? chosen.reduce((sum, s) => sum + s.durationMin, 0);
  const price = chosen.reduce(
    (sum, s) => sum + (s.comboPrice !== null && chosen.length > 1 ? s.comboPrice : s.price),
    0,
  );
  return { minutes, price };
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

const input = "field";

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <legend className="flex items-center gap-3 text-base font-medium">
      <span className="grid size-7 place-items-center rounded-full bg-charcoal text-xs text-white">{n}</span>
      {children}
    </legend>
  );
}

/** "Pon 13.10." -> ["Pon", "13.10."] for the two-line day chip. */
function splitDayLabel(label: string): [string, string] {
  const i = label.indexOf(" ");
  return i === -1 ? [label, ""] : [label.slice(0, i), label.slice(i + 1)];
}

export function BookingForm({
  slug,
  services,
  combos = [],
  workers,
  days,
  mode,
  submit,
  initialClient,
  requestUrgent,
  urgentSurcharge = 0,
  joinWaitlist,
  initialServiceIds,
  initialWorkerId,
}: BookingFormProps) {
  const [serviceIds, setServiceIds] = useState<string[]>(() =>
    (initialServiceIds ?? []).filter((id) => services.some((s) => s.id === id)),
  );
  const [workerId, setWorkerId] = useState<string>(workers.some((w) => w.id === initialWorkerId) ? initialWorkerId ?? "" : "");
  const [dateIso, setDateIso] = useState<string>(days.find((d) => !d.closed)?.iso ?? days[0]?.iso ?? "");
  const [minute, setMinute] = useState<number | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientName, setClientName] = useState(initialClient?.name ?? "");
  const [clientPhone, setClientPhone] = useState(initialClient?.phone ?? "");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const [urgent, setUrgent] = useState(false);
  // "services|date" -> outcome of joining the waitlist for that day.
  const [waitlist, setWaitlist] = useState<Record<string, UrgentResult>>({});
  const [reason, setReason] = useState("");
  const [urgentSent, setUrgentSent] = useState(false);

  // Chosen services in price-list order; "serviceKey" changes only when the set changes.
  const chosen = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds]);
  const serviceKey = chosen.map((s) => s.id).join(",");
  const hasService = chosen.length > 0;
  const summary = useMemo(() => visitSummary(chosen, combos), [chosen, combos]);
  const servicesText = chosen.map((s) => s.name).join(" + ");
  const toggleService = (id: string): void =>
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  useEffect(() => {
    if (!serviceKey || !dateIso) return;
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      try {
        setSlots(null);
        setLoadError(null);
        const params = new URLSearchParams({ serviceIds: serviceKey, date: dateIso });
        if (workerId) params.set("workerId", workerId);
        if (mode === "salon") params.set("scope", "salon");
        const res = await fetch(`/api/salons/${slug}/slots?${params.toString()}`, { signal: controller.signal });
        const data = (await res.json()) as SlotsResponse | { error: string };
        if ("error" in data) throw new Error(data.error);
        setSlots(data.slots.map((s) => s.minute));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Greška");
      }
    };
    void load();
    return () => controller.abort();
  }, [slug, serviceKey, workerId, dateIso, mode, refreshKey]);

  useEffect(() => {
    setMinute(null);
    setUrgent(false);
  }, [serviceKey, workerId, dateIso]);

  const onSubmit = (): void => {
    if (urgent && requestUrgent) {
      if (!hasService) return;
      startTransition(async () => {
        try {
          const res = await requestUrgent({
            serviceIds: chosen.map((s) => s.id),
            dateIso,
            clientName,
            clientPhone,
            reason,
          });
          if (res.ok) setUrgentSent(true);
          else setResult(res);
        } catch {
          setResult({ ok: false, error: "Došlo je do greške. Pokušajte ponovo." });
        }
      });
      return;
    }
    if (!hasService || minute === null) return;
    startTransition(async () => {
      try {
        const res = await submit({
          serviceIds: chosen.map((s) => s.id),
          workerId: workerId || null,
          dateIso,
          minute,
          clientName,
          clientPhone,
          note: note || null,
        });
        setResult(res);
        if (!res.ok) setRefreshKey((k) => k + 1);
      } catch {
        setResult({ ok: false, error: "Došlo je do greške. Pokušajte ponovo." });
      }
    });
  };

  const reset = (): void => {
    setResult(null);
    setMinute(null);
    setClientName(initialClient?.name ?? "");
    setClientPhone(initialClient?.phone ?? "");
    setNote("");
    setReason("");
    setUrgent(false);
    setUrgentSent(false);
    setRefreshKey((k) => k + 1);
  };

  if (urgentSent) {
    return (
      <div className="animate-rise rounded-2xl bg-burgundy-soft p-6 sm:p-10" role="status">
        <p className="eyebrow text-burgundy">Hitan zahtev je poslat</p>
        <p className="mt-3 font-serif text-3xl sm:text-4xl">
          {servicesText}, {days.find((d) => d.iso === dateIso)?.label ?? dateIso}
        </p>
        <p className="mt-2 text-muted">
          Salon će pokušati da nađe zamenu sa nekim od zakazanih mušterija i pozvaće vas na {clientPhone}.
        </p>
        {urgentSurcharge > 0 && (
          <p className="mt-2 text-sm text-muted">
            Hitan termin je skuplji za {formatRsd(urgentSurcharge)} po poseti, na cenu usluga.
          </p>
        )}
        <button type="button" onClick={reset} className="btn-secondary mt-8">
          Nazad na zakazivanje
        </button>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="animate-rise rounded-2xl bg-forest-soft p-6 sm:p-10" role="status">
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-forest text-xl text-white">
          ✓
        </span>
        <p className="eyebrow mt-6 text-forest">{mode === "public" ? "Termin je zakazan" : "Termin je upisan"}</p>
        <p className="mt-3 font-serif text-3xl sm:text-4xl">
          {servicesText}, {days.find((d) => d.iso === dateIso)?.label ?? dateIso} u {minute !== null ? hhmm(minute) : ""}
        </p>
        <p className="mt-2 text-muted">Frizer: {result.workerName}</p>
        {mode === "public" && (
          <p className="mt-6 text-sm text-muted">
            Sačuvajte ovaj link, preko njega otkazujete ili pomerate termin i dodajete ga u kalendar:{" "}
            <a href={`/termin/${result.manageToken}`} className="text-burgundy underline underline-offset-4">
              Moj termin
            </a>
          </p>
        )}
        <button type="button" onClick={reset} className="btn-secondary mt-8">
          {mode === "public" ? "Zakaži još jedan termin" : "Upiši sledeći termin"}
        </button>
      </div>
    );
  }

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <form
      className="@container grid min-w-0 gap-10"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="min-w-0">
        <StepTitle n={1}>Usluge</StepTitle>
        <p className="mt-1 text-sm text-muted">Možete izabrati više usluga za isti termin.</p>
        <div className="mt-4 grid gap-5">
          {categories.map((category) => (
            <div key={category}>
              {categories.length > 1 && <p className="eyebrow mb-2">{category}</p>}
              <div className="grid gap-2 @md:grid-cols-2">
                {services
                  .filter((s) => s.category === category)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={serviceIds.includes(s.id)}
                      onClick={() => toggleService(s.id)}
                      className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 text-left transition-all duration-200 hover:border-charcoal aria-pressed:border-burgundy aria-pressed:bg-burgundy-soft aria-pressed:ring-1 aria-pressed:ring-burgundy"
                    >
                      <span
                        aria-hidden
                        className="grid size-5 shrink-0 place-items-center rounded-md border border-line bg-white text-xs leading-none text-white group-aria-pressed:border-burgundy group-aria-pressed:bg-burgundy"
                      >
                        <span className="opacity-0 group-aria-pressed:opacity-100">✓</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.name}</span>
                        <span className="block text-xs text-muted">
                          {s.durationMin} min · {s.priceLabel}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {workers.length > 1 && (
        <fieldset className="min-w-0">
          <StepTitle n={2}>Frizer</StepTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" aria-pressed={workerId === ""} onClick={() => setWorkerId("")} className="chip">
              Bilo ko
            </button>
            {workers.map((w) => (
              <button key={w.id} type="button" aria-pressed={w.id === workerId} onClick={() => setWorkerId(w.id)} className="chip">
                {w.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="min-w-0">
        <StepTitle n={workers.length > 1 ? 3 : 2}>Dan</StepTitle>
        <div className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {days.map((d) => {
            const [weekday, date] = splitDayLabel(d.label);
            return (
              <button
                key={d.iso}
                type="button"
                disabled={d.closed}
                aria-pressed={d.iso === dateIso}
                aria-label={d.closed ? `${d.label}, zatvoreno` : d.label}
                onClick={() => setDateIso(d.iso)}
                className="flex w-16 shrink-0 snap-start flex-col items-center rounded-xl border border-line bg-white py-2.5 transition-all duration-200 hover:border-charcoal disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line aria-pressed:border-burgundy aria-pressed:bg-burgundy aria-pressed:text-white"
              >
                <span className="text-[11px] uppercase tracking-wider opacity-70">{weekday}</span>
                <span className="mt-0.5 text-sm font-medium tabular-nums">{date}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <StepTitle n={workers.length > 1 ? 4 : 3}>Slobodni termini</StepTitle>
        <div className="mt-4 min-h-12" aria-live="polite">
          {!hasService && <p className="rounded-xl bg-sand/60 px-4 py-3 text-sm text-muted">Prvo izaberite uslugu.</p>}
          {hasService && slots === null && !loadError && (
            <div className="grid grid-cols-4 gap-2 @md:grid-cols-6" aria-label="Učitavam termine">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="h-11 animate-pulse rounded-full bg-sand" />
              ))}
            </div>
          )}
          {loadError && <p className="alert-error">{loadError}</p>}
          {slots && slots.length === 0 && !urgent && (
            <div className="grid gap-3">
              <p className="rounded-xl bg-sand/60 px-4 py-3 text-sm text-muted">Nema slobodnih termina za ovaj dan. Probajte drugi dan.</p>
              {joinWaitlist && hasService && dateIso && !days.find((d) => d.iso === dateIso)?.closed && (
                <WaitlistOffer
                  outcome={waitlist[`${serviceKey}|${dateIso}`]}
                  loginHref={`/prijava?next=${encodeURIComponent(`/s/${slug}#zakazivanje`)}`}
                  onJoin={async () => {
                    const key = `${serviceKey}|${dateIso}`;
                    try {
                      const res = await joinWaitlist(chosen.map((s) => s.id), dateIso);
                      setWaitlist((w) => ({ ...w, [key]: res }));
                    } catch {
                      setWaitlist((w) => ({ ...w, [key]: { ok: false, error: "Došlo je do greške. Pokušajte ponovo." } }));
                    }
                  }}
                />
              )}
              {requestUrgent && !days.find((d) => d.iso === dateIso)?.closed && (
                <div className="rounded-xl border border-burgundy/25 p-4">
                  <p className="text-sm">Morate baš ovog dana? Pošaljite hitan zahtev i salon će probati da zameni termin sa nekim.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUrgent(true);
                      setResult(null);
                    }}
                    className="btn btn-sm mt-3 border border-burgundy text-burgundy hover:bg-burgundy hover:text-white"
                  >
                    Hitno zakazivanje
                  </button>
                </div>
              )}
            </div>
          )}
          {urgent && (
            <div className="grid gap-3 rounded-xl border border-burgundy/25 bg-burgundy-soft/50 p-4">
              <p className="text-sm font-medium text-burgundy">Hitan zahtev</p>
              <p className="text-sm text-burgundy/90">
                {urgentSurcharge > 0
                  ? `Hitni termini su skuplji: na cenu izabranih usluga dodaje se ${formatRsd(urgentSurcharge)} po poseti${
                      hasService ? ` (ukupno ${formatRsd(summary.price + urgentSurcharge)})` : ""
                    }. Salon vas poziva da potvrdi termin.`
                  : "Salon vas poziva da potvrdi termin."}
              </p>
              <label className="block">
                <span className="field-label">Zašto vam je hitno?</span>
                <textarea
                  className={`${input} resize-none`}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                  maxLength={300}
                />
              </label>
              <button type="button" onClick={() => setUrgent(false)} className="link justify-self-start text-xs text-muted">
                Odustani od hitnog zahteva
              </button>
            </div>
          )}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-4 gap-2 @md:grid-cols-6">
              {slots.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === minute}
                  onClick={() => setMinute(m)}
                  className="chip px-0 tabular-nums"
                >
                  {hhmm(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="grid min-w-0 gap-4 @md:grid-cols-2">
        <StepTitle n={workers.length > 1 ? 5 : 4}>{mode === "public" ? "Vaši podaci" : "Podaci mušterije"}</StepTitle>
        <label className="block">
          <span className="field-label">Ime i prezime</span>
          <input className={input} value={clientName} onChange={(e) => setClientName(e.target.value)} required autoComplete="name" />
        </label>
        <label className="block">
          <span className="field-label">Telefon</span>
          <input
            className={input}
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="06x xxx xxxx"
          />
        </label>
        <label className="block @md:col-span-2">
          <span className="field-label">
            Napomena <span className="font-normal text-muted">(nije obavezno)</span>
          </span>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </fieldset>

      <p className="text-xs text-muted">
        Ime i telefon koristimo samo za ovaj termin, da vas salon prepozna i pozove ako je potrebno.{" "}
        <a href="/privatnost" target="_blank" className="link">
          Politika privatnosti
        </a>
      </p>

      {result && !result.ok && (
        <p className="alert-error" role="alert">
          {result.error}
        </p>
      )}

      <div className="grid gap-3 rounded-2xl bg-cream p-4 @md:grid-cols-[1fr_auto] @md:items-center">
        <p className="text-sm text-muted" aria-live="polite">
          {hasService ? (
            <>
              <span className="font-medium text-charcoal">{servicesText}</span>
              {" · "}
              {days.find((d) => d.iso === dateIso)?.label}
              {minute !== null && ` u ${hhmm(minute)}`}
              {" · "}
              {summary.minutes} min · {formatPrice(summary.price)}
            </>
          ) : (
            "Izaberite uslugu i vreme."
          )}
        </p>
        <button type="submit" disabled={pending || !hasService || (!urgent && minute === null)} className="btn-primary w-full px-8 @md:w-auto">
          {pending
            ? "Šaljem…"
            : urgent
              ? "Pošalji hitan zahtev"
              : mode === "public"
                ? "Zakaži termin"
                : "Upiši termin"}
        </button>
      </div>
    </form>
  );
}

function WaitlistOffer(props: { outcome: UrgentResult | undefined; loginHref: string; onJoin: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  if (props.outcome?.ok) {
    return (
      <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-forest" role="status">
        Na listi čekanja ste. Ako se oslobodi termin, javljamo vam mejlom.
      </p>
    );
  }
  const error = props.outcome && !props.outcome.ok ? props.outcome.error : null;
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm">Javite mi mejlom ako se ovog dana oslobodi termin.</p>
      {error === "login" ? (
        <a href={props.loginHref} className="btn-secondary btn-sm mt-3">
          Prijavite se za listu čekanja
        </a>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(props.onJoin)}
          className="btn-secondary btn-sm mt-3"
        >
          {pending ? "Upisujem…" : "Lista čekanja"}
        </button>
      )}
      {error && error !== "login" && <p className="alert-error mt-3">{error}</p>}
    </div>
  );
}
