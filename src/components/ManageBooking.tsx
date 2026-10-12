"use client";

import { useEffect, useState, useTransition } from "react";
import type { SlotsResponse } from "@/app/api/salons/[slug]/slots/route";

type Result = { ok: true } | { ok: false; error: string };

interface ManageBookingProps {
  slug: string;
  // The booking's manage token: free times are searched for this booking's own length.
  token: string;
  days: Array<{ iso: string; label: string; closed: boolean }>;
  cancel: () => Promise<Result>;
  reschedule: (dateIso: string, minute: number) => Promise<Result>;
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

const chip = "chip";
const chipOn = "border-burgundy bg-burgundy text-white hover:border-burgundy";
const chipOff = "";

/** Cancel or move a booking from the customer's manage link. */
export function ManageBooking({ slug, token, days, cancel, reschedule }: ManageBookingProps) {
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
    fetch(`/api/salons/${slug}/slots?token=${encodeURIComponent(token)}&date=${dateIso}`)
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
  }, [dateIso, slug, token]);

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
            className="btn-primary"
          >
            Pomeri termin
          </button>
          <button
            type="button"
            onClick={() => setMode("confirmCancel")}
            className="btn-secondary"
          >
            Otkaži termin
          </button>
        </div>
      )}

      {mode === "confirmCancel" && (
        <div className="rounded-2xl border border-burgundy/30 bg-burgundy-soft p-5">
          <p>Sigurno želite da otkažete termin?</p>
          <div className="mt-4 flex gap-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(cancel)}
              className="btn-primary"
            >
              {pending ? "Otkazujem…" : "Da, otkaži"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="btn-ghost">
              Ne
            </button>
          </div>
        </div>
      )}

      {mode === "move" && (
        <div className="card grid gap-6 p-5">
          <div>
            <p className="eyebrow">Novi dan</p>
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
              <p className="eyebrow">Novo vreme</p>
              {slots === null && <p className="mt-3 text-sm text-muted">Učitavam slobodne termine…</p>}
              {slots?.length === 0 && <p className="mt-3 text-sm text-muted">Tog dana nema slobodnih termina.</p>}
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
              className="btn-primary"
            >
              {pending ? "Pomeram…" : "Potvrdi novi termin"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="btn-ghost">
              Odustani
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
    </div>
  );
}
