"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookingService, BookingWorker } from "./BookingForm";
import { formatRsd } from "@/lib/money";

export interface UrgentChatValues {
  serviceIds: string[];
  workerId: string | null;
  dateIso: string;
  timeWish: string;
  reason: string;
}

interface UrgentBookingCardProps {
  slug: string;
  services: BookingService[];
  workers: BookingWorker[];
  days: Array<{ iso: string; label: string; closed: boolean }>;
  /** Extra charge for an urgent appointment, in para (0 = none). */
  surcharge: number;
  /** "guest" is sent to login first; "other" is staff or developer looking at the page. */
  viewer: "guest" | "client" | "other";
  start: (values: UrgentChatValues) => Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Always visible "Hitna rezervacija": opens the chat with the salon with the urgent request as first message. */
export function UrgentBookingCard({ slug, services, workers, days, surcharge, viewer, start }: UrgentBookingCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [workerId, setWorkerId] = useState("");
  const openDays = days.filter((d) => !d.closed);
  const [dateIso, setDateIso] = useState(openDays[0]?.iso ?? "");
  const [timeWish, setTimeWish] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The mobile bar and the login return link both point at #hitno.
  useEffect(() => {
    const check = (): void => {
      if (window.location.hash === "#hitno") setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const loginHref = `/prijava?next=${encodeURIComponent(`/s/${slug}#hitno`)}`;
  const toggle = (id: string): void =>
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = (): void => {
    setError(null);
    if (serviceIds.length === 0) return setError("Izaberite uslugu.");
    startTransition(async () => {
      try {
        const res = await start({ serviceIds, workerId: workerId || null, dateIso, timeWish, reason });
        if (res.ok) router.push(`/poruke/${slug}`);
        else if (res.error === "login") router.push(loginHref);
        else setError(res.error);
      } catch {
        setError("Došlo je do greške. Pokušajte ponovo.");
      }
    });
  };

  return (
    <div id="hitno" className="scroll-mt-24 rounded-2xl border border-burgundy/30 bg-burgundy-soft/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-serif text-2xl leading-tight">Hitna rezervacija</p>
          <p className="mt-1 text-sm text-muted">
            Nema slobodnog termina, a hitno vam treba? Javite se salonu u chatu i dogovorite termin.
            {surcharge > 0 && ` Hitan termin je skuplji za ${formatRsd(surcharge)}.`}
          </p>
        </div>
        {viewer !== "other" && (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0" aria-haspopup="dialog">
            Hitna rezervacija
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hitna rezervacija"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif text-2xl leading-tight">Hitna rezervacija</p>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost size-10 shrink-0 p-0 text-lg" aria-label="Zatvori">
                ✕
              </button>
            </div>

      {viewer === "guest" && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm">Da bismo mogli da razgovaramo, prijavite se ili napravite nalog (potreban je samo email). Posle prijave vraćate se ovde.</p>
          <div className="flex flex-wrap gap-2">
            <a href={loginHref} className="btn-primary">Prijavi se</a>
            <a href={`/registracija?next=${encodeURIComponent(`/s/${slug}#hitno`)}`} className="btn-secondary">Napravi nalog</a>
          </div>
        </div>
      )}

      {viewer === "client" && (
        <div className="mt-4 grid gap-4">
          <fieldset className="min-w-0">
            <legend className="field-label">Usluga</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {services.map((s) => (
                <button key={s.id} type="button" aria-pressed={serviceIds.includes(s.id)} onClick={() => toggle(s.id)} className="chip">
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
          {workers.length > 1 && (
            <fieldset className="min-w-0">
              <legend className="field-label">Frizer</legend>
              <div className="mt-2 flex flex-wrap gap-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Dan</span>
              <select className="field" value={dateIso} onChange={(e) => setDateIso(e.target.value)}>
                {openDays.map((d) => (
                  <option key={d.iso} value={d.iso}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Kada vam odgovara</span>
              <input className="field" value={timeWish} onChange={(e) => setTimeWish(e.target.value)} maxLength={80} placeholder="npr. što pre, posle 17h" />
            </label>
          </div>
          <label className="block">
            <span className="field-label">Zašto vam je hitno?</span>
            <textarea className="field resize-none" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </label>
          {error && <p className="alert-error" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={submit} disabled={pending || reason.trim().length < 5} className="btn-primary">
              {pending ? "Otvaram chat…" : "Pošalji i otvori chat"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="link text-sm text-muted">
              Odustani
            </button>
          </div>
        </div>
      )}
          </div>
        </div>
      )}
    </div>
  );
}
