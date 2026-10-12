"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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

const chip =
  "rounded-full border px-4 py-2 text-sm transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-30";
const chipOn = "border-burgundy bg-burgundy text-white";
const chipOff = "border-neutral-300 hover:-translate-y-0.5 hover:border-neutral-500";
const label = "text-xs uppercase tracking-[0.2em] text-neutral-500";
const input =
  "mt-2 w-full border-b border-neutral-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-burgundy";

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
      <div className="border border-neutral-200 p-8 md:p-12" role="status">
        <p className={label}>Hitan zahtev je poslat</p>
        <p className="mt-4 font-serif text-4xl">
          {service?.name}, {days.find((d) => d.iso === dateIso)?.label ?? dateIso}
        </p>
        <p className="mt-2 text-neutral-600">
          Salon će pokušati da nađe zamenu sa nekim od zakazanih mušterija i pozvaće vas na {clientPhone}.
        </p>
        <button type="button" onClick={reset} className="mt-8 text-sm underline underline-offset-4 hover:text-burgundy">
          Nazad na zakazivanje
        </button>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="border border-neutral-200 p-8 md:p-12" role="status">
        <p className={label}>{mode === "public" ? "Termin je zakazan" : "Termin je upisan"}</p>
        <p className="mt-4 font-serif text-4xl">
          {service?.name}, {days.find((d) => d.iso === dateIso)?.label ?? dateIso} u {minute !== null ? hhmm(minute) : ""}
        </p>
        <p className="mt-2 text-neutral-600">Frizer: {result.workerName}</p>
        {mode === "public" && (
          <p className="mt-6 text-sm text-neutral-600">
            Sačuvajte ovaj link, preko njega otkazujete ili pomerate termin i dodajete ga u kalendar:{" "}
            <a href={`/termin/${result.manageToken}`} className="break-all text-burgundy underline underline-offset-4">
              Moj termin
            </a>
          </p>
        )}
        <button type="button" onClick={reset} className="mt-8 text-sm underline underline-offset-4 hover:text-burgundy">
          {mode === "public" ? "Zakaži još jedan termin" : "Upiši sledeći termin"}
        </button>
      </div>
    );
  }

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <form
      className="grid min-w-0 gap-12"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="min-w-0">
        <legend className={label}>1. Usluga</legend>
        <div className="mt-4 grid gap-6">
          {categories.map((category) => (
            <div key={category} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm text-neutral-400">{category}</span>
              {services
                .filter((s) => s.category === category)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === serviceId}
                    onClick={() => setServiceId(s.id)}
                    className={`${chip} ${s.id === serviceId ? chipOn : chipOff}`}
                  >
                    {s.name}
                  </button>
                ))}
            </div>
          ))}
        </div>
        {service && (
          <p className="mt-4 text-sm text-neutral-600">
            {service.priceLabel} · {service.durationMin} min
          </p>
        )}
      </fieldset>

      {workers.length > 1 && (
        <fieldset className="min-w-0">
          <legend className={label}>2. Frizer</legend>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={workerId === ""}
              onClick={() => setWorkerId("")}
              className={`${chip} ${workerId === "" ? chipOn : chipOff}`}
            >
              Bilo ko
            </button>
            {workers.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={w.id === workerId}
                onClick={() => setWorkerId(w.id)}
                className={`${chip} ${w.id === workerId ? chipOn : chipOff}`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="min-w-0">
        <legend className={label}>{workers.length > 1 ? "3" : "2"}. Dan</legend>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => (
            <button
              key={d.iso}
              type="button"
              disabled={d.closed}
              aria-pressed={d.iso === dateIso}
              onClick={() => setDateIso(d.iso)}
              className={`${chip} shrink-0 ${d.iso === dateIso ? chipOn : chipOff}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={label}>{workers.length > 1 ? "4" : "3"}. Slobodni termini</legend>
        <div className="mt-4 min-h-12" aria-live="polite">
          {!serviceId && <p className="text-sm text-neutral-500">Prvo izaberite uslugu.</p>}
          {serviceId && slots === null && !loadError && <p className="text-sm text-neutral-500">Učitavam termine…</p>}
          {loadError && <p className="text-sm text-burgundy">{loadError}</p>}
          {slots && slots.length === 0 && !urgent && (
            <div className="grid gap-3">
              <p className="text-sm text-neutral-500">Nema slobodnih termina za ovaj dan. Probajte drugi dan.</p>
              {requestUrgent && !days.find((d) => d.iso === dateIso)?.closed && (
                <div className="border-l-2 border-burgundy pl-4">
                  <p className="text-sm">Morate baš ovog dana? Pošaljite hitan zahtev i salon će probati da zameni termin sa nekim.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUrgent(true);
                      setResult(null);
                    }}
                    className="mt-3 border border-burgundy px-4 py-2 text-sm text-burgundy transition-colors hover:bg-burgundy hover:text-white"
                  >
                    Hitno zakazivanje
                  </button>
                </div>
              )}
            </div>
          )}
          {urgent && (
            <div className="grid gap-2 border-l-2 border-burgundy pl-4">
              <p className="text-sm font-medium text-burgundy">Hitan zahtev</p>
              <label className="block">
                <span className="text-sm text-neutral-600">Zašto vam je hitno?</span>
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
              <button
                type="button"
                onClick={() => setUrgent(false)}
                className="justify-self-start text-xs underline underline-offset-4 text-neutral-500 hover:text-burgundy"
              >
                Odustani od hitnog zahteva
              </button>
            </div>
          )}
          {slots && slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slots.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === minute}
                  onClick={() => setMinute(m)}
                  className={`${chip} font-mono ${m === minute ? chipOn : chipOff}`}
                >
                  {hhmm(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="grid min-w-0 gap-8 md:grid-cols-2">
        <legend className={`${label} mb-2`}>{mode === "public" ? "Vaši podaci" : "Podaci mušterije"}</legend>
        <label className="block">
          <span className="text-sm text-neutral-600">Ime i prezime</span>
          <input className={input} value={clientName} onChange={(e) => setClientName(e.target.value)} required autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-600">Telefon</span>
          <input
            className={input}
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            required
            type="tel"
            autoComplete="tel"
            placeholder="06x xxx xxxx"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-neutral-600">Napomena (nije obavezno)</span>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </fieldset>

      {result && !result.ok && (
        <p className="border-l-2 border-burgundy pl-4 text-burgundy" role="alert">
          {result.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !serviceId || (!urgent && minute === null)}
        className="justify-self-start bg-burgundy px-10 py-4 text-sm uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? "Šaljem…"
          : urgent
            ? "Pošalji hitan zahtev"
            : mode === "public"
              ? "Zakaži termin"
              : "Upiši termin"}
      </button>
    </form>
  );
}
