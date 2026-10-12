"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type React from "react";
import type { BookingResult } from "@/lib/booking";
import type { SlotsResponse } from "@/app/api/salons/[slug]/slots/route";

export interface BookingService {
  id: string;
  name: string;
  category: string;
  priceLabel: string;
  durationMin: number;
}

export interface BookingWorker {
  id: string;
  name: string;
}

export interface BookingFormValues {
  serviceId: string;
  workerId: string | null;
  dateIso: string;
  minute: number;
  clientName: string;
  clientPhone: string;
  note: string | null;
}

export interface UrgentFormValues {
  serviceId: string;
  dateIso: string;
  clientName: string;
  clientPhone: string;
  reason: string;
}

export type UrgentResult = { ok: true } | { ok: false; error: string };

interface BookingFormProps {
  slug: string;
  services: BookingService[];
  workers: BookingWorker[];
  days: Array<{ iso: string; label: string; closed: boolean }>;
  mode: "public" | "salon";
  submit: (values: BookingFormValues) => Promise<BookingResult>;
  /** Prefills name and phone for a logged-in customer. */
  initialClient?: { name: string; phone: string };
  // When set, a fully booked day offers an urgent request the salon reviews by hand.
  requestUrgent?: (values: UrgentFormValues) => Promise<UrgentResult>;
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

export function BookingForm({ slug, services, workers, days, mode, submit, initialClient, requestUrgent }: BookingFormProps) {
  const [serviceId, setServiceId] = useState<string>("");
  const [workerId, setWorkerId] = useState<string>("");
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
  const [reason, setReason] = useState("");
  const [urgentSent, setUrgentSent] = useState(false);

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);

  useEffect(() => {
    if (!serviceId || !dateIso) return;
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      try {
        setSlots(null);
        setLoadError(null);
        const params = new URLSearchParams({ serviceId, date: dateIso });
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
  }, [slug, serviceId, workerId, dateIso, mode, refreshKey]);

  useEffect(() => {
    setMinute(null);
    setUrgent(false);
  }, [serviceId, workerId, dateIso]);

  const onSubmit = (): void => {
    if (urgent && requestUrgent) {
      if (!serviceId) return;
      startTransition(async () => {
        try {
          const res = await requestUrgent({ serviceId, dateIso, clientName, clientPhone, reason });
          if (res.ok) setUrgentSent(true);
          else setResult(res);
        } catch {
          setResult({ ok: false, error: "Došlo je do greške. Pokušajte ponovo." });
        }
      });
      return;
    }
    if (!serviceId || minute === null) return;
    startTransition(async () => {
      try {
        const res = await submit({
          serviceId,
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
          {service?.name}, {days.find((d) => d.iso === dateIso)?.label ?? dateIso}
        </p>
        <p className="mt-2 text-muted">
          Salon će pokušati da nađe zamenu sa nekim od zakazanih mušterija i pozvaće vas na {clientPhone}.
        </p>
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
          {service?.name}, {days.find((d) => d.iso === dateIso)?.label ?? dateIso} u {minute !== null ? hhmm(minute) : ""}
        </p>
        <p className="mt-2 text-muted">Frizer: {result.workerName}</p>
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
        <StepTitle n={1}>Usluga</StepTitle>
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
                      aria-pressed={s.id === serviceId}
                      onClick={() => setServiceId(s.id)}
                      className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 text-left transition-all duration-200 hover:border-charcoal aria-pressed:border-burgundy aria-pressed:bg-burgundy-soft aria-pressed:ring-1 aria-pressed:ring-burgundy"
                    >
                      <span
                        aria-hidden
                        className="grid size-5 shrink-0 place-items-center rounded-full border border-line bg-white group-aria-pressed:border-burgundy group-aria-pressed:bg-burgundy"
                      >
                        <span className="size-2 rounded-full bg-white opacity-0 group-aria-pressed:opacity-100" />
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
          {!serviceId && <p className="rounded-xl bg-sand/60 px-4 py-3 text-sm text-muted">Prvo izaberite uslugu.</p>}
          {serviceId && slots === null && !loadError && (
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

      {result && !result.ok && (
        <p className="alert-error" role="alert">
          {result.error}
        </p>
      )}

      <div className="grid gap-3 rounded-2xl bg-cream p-4 @md:grid-cols-[1fr_auto] @md:items-center">
        <p className="text-sm text-muted" aria-live="polite">
          {service ? (
            <>
              <span className="font-medium text-charcoal">{service.name}</span>
              {" · "}
              {days.find((d) => d.iso === dateIso)?.label}
              {minute !== null && ` u ${hhmm(minute)}`}
              {" · "}
              {service.priceLabel}
            </>
          ) : (
            "Izaberite uslugu i vreme."
          )}
        </p>
        <button type="submit" disabled={pending || !serviceId || (!urgent && minute === null)} className="btn-primary w-full px-8 @md:w-auto">
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
