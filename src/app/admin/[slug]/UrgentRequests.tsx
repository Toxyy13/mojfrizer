"use client";

import { useActionState } from "react";
import type { SwapState } from "./actions";

export interface UrgentRequestView {
  id: string;
  name: string;
  phone: string;
  serviceName: string;
  durationMinutes: number;
  dateIso: string;
  dateLabel: string;
  reason: string;
  // Booked appointments that day which could give up their slot.
  candidates: Array<{ id: string; label: string }>;
}

interface UrgentRequestsProps {
  requests: UrgentRequestView[];
  swap: (prev: SwapState, formData: FormData) => Promise<SwapState>;
  close: (formData: FormData) => Promise<void>;
}

const field = "mt-1 w-full border-b border-neutral-300 bg-transparent py-1 outline-none focus:border-burgundy";

export function UrgentRequests({ requests, swap, close }: UrgentRequestsProps) {
  return (
    <section className="mt-12 border border-burgundy p-8" aria-labelledby="hitni-zahtevi">
      <h2 id="hitni-zahtevi" className="font-serif text-3xl text-burgundy">
        Hitni zahtevi ({requests.length})
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Pozovite nekog od zakazanih da se pomeri, pa upišite zamenu: hitna mušterija dobija njegov termin, a on novo vreme.
      </p>
      <ul className="mt-6 grid gap-6 md:grid-cols-2">
        {requests.map((r) => (
          <li key={r.id} className="border-t border-neutral-200 pt-4">
            <RequestCard request={r} swap={swap} close={close} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestCard({
  request,
  swap,
  close,
}: {
  request: UrgentRequestView;
  swap: UrgentRequestsProps["swap"];
  close: UrgentRequestsProps["close"];
}) {
  const [state, action, pending] = useActionState<SwapState, FormData>(swap, { error: null });
  return (
    <article aria-label={`Hitan zahtev: ${request.name}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{request.dateLabel}</p>
      <p className="mt-1 text-lg font-medium">
        {request.name} ·{" "}
        <a href={`tel:${request.phone.replace(/\s/g, "")}`} className="underline underline-offset-2">
          {request.phone}
        </a>
      </p>
      <p className="text-sm">
        {request.serviceName} · {request.durationMinutes} min
      </p>
      <p className="mt-2 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600">{request.reason}</p>

      {request.candidates.length > 0 ? (
        <form action={action} className="mt-4 grid gap-3 text-sm">
          <input type="hidden" name="requestId" value={request.id} />
          <label>
            <span className="text-neutral-600">Termin koji ustupa</span>
            <select name="appointmentId" required className={field}>
              {request.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-neutral-600">Novi dan za njega</span>
              <input type="date" name="newDateIso" defaultValue={request.dateIso} required className={field} />
            </label>
            <label>
              <span className="text-neutral-600">Novo vreme</span>
              <input type="time" name="newTime" step={300} required className={field} />
            </label>
          </div>
          {state.error && (
            <p className="text-burgundy" role="alert">
              {state.error}
            </p>
          )}
          <button
            disabled={pending}
            className="justify-self-start bg-burgundy px-4 py-2 text-white transition-colors hover:bg-burgundy-dark disabled:opacity-40"
          >
            {pending ? "Upisujem…" : "Upiši zamenu"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">Tog dana nema zakazanih termina za zamenu.</p>
      )}

      <div className="mt-3 flex gap-3 text-xs">
        <CloseButton close={close} id={request.id} status="RESOLVED" label="Rešeno drugačije" />
        <CloseButton close={close} id={request.id} status="DECLINED" label="Odbij" />
      </div>
    </article>
  );
}

function CloseButton(props: { close: UrgentRequestsProps["close"]; id: string; status: string; label: string }) {
  return (
    <form action={props.close}>
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="status" value={props.status} />
      <button className="border border-neutral-300 px-2 py-1 transition-colors hover:border-charcoal">{props.label}</button>
    </form>
  );
}
