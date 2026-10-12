"use client";

import { useEffect, useState, useTransition } from "react";
import type { SlotsResponse } from "@/app/api/salons/[slug]/slots/route";

type Result = { ok: true } | { ok: false; error: string };

interface ManageBookingProps {
  slug: string;
  serviceId: string;
  days: Array<{ iso: string; label: string; closed: boolean }>;
  cancel: () => Promise<Result>;
  reschedule: (dateIso: string, minute: number) => Promise<Result>;
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

const chip =
  "rounded-full border px-4 py-2 text-sm transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-30";
const chipOn = "border-burgundy bg-burgundy text-white";
const chipOff = "border-neutral-300 hover:-translate-y-0.5 hover:border-neutral-500";

/** Cancel or move a booking from the customer's manage link. */
export function ManageBooking({ slug, serviceId, days, cancel, reschedule }: ManageBookingProps) {
  const [mode, setMode] = useState<"idle" | "move" | "confirmCancel">("idle");
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [minute, setMinute] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dateIso) return;
    let active = true;
    setSlots(null);
    setMinute(null);
    fetch(`/api/salons/${slug}/slots?serviceId=${encodeURIComponent(serviceId)}&date=${dateIso}`)
      .then((r) => r.json() as Promise<SlotsResponse>)
      .then((data) => {
        if (active) setSlots((data.slots ?? []).map((s) => s.minute));
      })
      .catch(() => {
        if (active) setSlots([]);
      });
    return () => {
      active = false;
    };
  }, [dateIso, slug, serviceId]);

  const run = (action: () => Promise<Result>): void => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      else setMode("idle");
    });
  };

  return (
    <div className="grid gap-6">
      {mode === "idle" && (
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => setMode("move")}
            className="bg-charcoal px-6 py-3 text-sm text-white transition-colors hover:bg-burgundy"
          >
            Pomeri termin
          </button>
          <button
            type="button"
            onClick={() => setMode("confirmCancel")}
            className="border border-neutral-300 px-6 py-3 text-sm transition-colors hover:border-burgundy hover:text-burgundy"
          >
            Otkaži termin
          </button>
        </div>
      )}

      {mode === "confirmCancel" && (
        <div className="border border-burgundy p-6">
          <p>Sigurno želite da otkažete termin?</p>
          <div className="mt-4 flex gap-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(cancel)}
              className="bg-burgundy px-6 py-3 text-sm text-white disabled:opacity-50"
            >
              {pending ? "Otkazujem…" : "Da, otkaži"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="text-sm underline underline-offset-4">
              Ne
            </button>
          </div>
        </div>
      )}

      {mode === "move" && (
        <div className="grid gap-6 border border-neutral-200 p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Novi dan</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  disabled={d.closed}
                  onClick={() => setDateIso(d.iso)}
                  className={`${chip} ${dateIso === d.iso ? chipOn : chipOff}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {dateIso && (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Novo vreme</p>
              {slots === null && <p className="mt-3 text-sm text-neutral-500">Učitavam slobodne termine…</p>}
              {slots?.length === 0 && <p className="mt-3 text-sm text-neutral-500">Tog dana nema slobodnih termina.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {slots?.map((m) => (
                  <button key={m} type="button" onClick={() => setMinute(m)} className={`${chip} ${minute === m ? chipOn : chipOff}`}>
                    {hhmm(m)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4">
            <button
              type="button"
              disabled={pending || !dateIso || minute === null}
              onClick={() => dateIso && minute !== null && run(() => reschedule(dateIso, minute))}
              className="bg-burgundy px-6 py-3 text-sm text-white disabled:opacity-40"
            >
              {pending ? "Pomeram…" : "Potvrdi novi termin"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="text-sm underline underline-offset-4">
              Odustani
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-burgundy">
          {error}
        </p>
      )}
    </div>
  );
}
