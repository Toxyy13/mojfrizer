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
  // Chat flow: preferred hairdresser, time wish, and the conversation link (null for a request without an account).
  workerName: string | null;
  timeWish: string | null;
  chatHref: string | null;
  // Extra the customer was told they pay for an urgent visit, formatted (empty = none).
  surchargeLabel: string;
  totalLabel: string;
  // Booked appointments that day which could give up their slot.
  candidates: Array<{ id: string; label: string }>;
}

interface UrgentRequestsProps {
  requests: UrgentRequestView[];
  swap: (prev: SwapState, formData: FormData) => Promise<SwapState>;
  close: (formData: FormData) => Promise<void>;
}

const field = "field py-2 text-sm";

export function UrgentRequests({ requests, swap, close }: UrgentRequestsProps) {
  return (
    <section className="mt-6 rounded-xl border border-burgundy/30 bg-burgundy-soft p-5 sm:p-6" aria-labelledby="hitni-zahtevi">
      <h2 id="hitni-zahtevi" className="flex items-center gap-2 font-serif text-2xl text-burgundy">
        <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-burgundy" />
        Hitni zahtevi ({requests.length})
      </h2>
      <p className="mt-1 text-sm text-burgundy/80">
        Pozovite nekog od zakazanih da se pomeri, pa upišite zamenu: hitna mušterija dobija njegov termin, a on novo vreme.
      </p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {requests.map((r) => (
          <li key={r.id} className="card p-5">
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
      <p className="eyebrow">{request.dateLabel}</p>
      <p className="mt-1 text-lg font-medium">
        {request.name}
        {request.phone && (
          <>
            {" · "}
            <a href={`tel:${request.phone.replace(/\s/g, "")}`} className="link">
              {request.phone}
            </a>
          </>
        )}
        {request.chatHref && (
          <>
            {" · "}
            <a href={request.chatHref} className="link">
              Otvori chat
            </a>
          </>
        )}
      </p>
      <p className="text-sm text-muted">
        {request.serviceName} · {request.durationMinutes} min
        {request.workerName && ` · ${request.workerName}`}
        {request.timeWish && ` · ${request.timeWish}`}
      </p>
      {request.surchargeLabel && (
        <p className="mt-1 text-sm font-medium text-burgundy">
          Hitna doplata {request.surchargeLabel} · ukupno {request.totalLabel}
        </p>
      )}
      <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm text-muted">„{request.reason}”</p>

      {request.candidates.length > 0 ? (
        <form action={action} className="mt-4 grid gap-3 text-sm">
          <input type="hidden" name="requestId" value={request.id} />
          <label>
            <span className="field-label">Termin koji ustupa</span>
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
              <span className="field-label">Novi dan za njega</span>
              <input type="date" name="newDateIso" defaultValue={request.dateIso} required className={field} />
            </label>
            <label>
              <span className="field-label">Novo vreme</span>
              <input type="time" name="newTime" step={300} required className={field} />
            </label>
          </div>
          {state.error && (
            <p className="alert-error" role="alert">
              {state.error}
            </p>
          )}
          <button
            disabled={pending}
            className="btn-primary btn-sm justify-self-start"
          >
            {pending ? "Upisujem…" : "Upiši zamenu"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Tog dana nema zakazanih termina za zamenu.</p>
      )}

      <div className="mt-4 flex gap-2 border-t border-line pt-4">
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
      <button className="btn-secondary btn-sm">{props.label}</button>
    </form>
  );
}
