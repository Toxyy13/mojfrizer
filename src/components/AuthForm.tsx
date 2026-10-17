"use client";

import Script from "next/script";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { FormState } from "@/app/prijava/actions";

interface AuthField {
  name: string;
  label: string;
  type: "text" | "tel" | "email" | "password" | "checkbox";
  autoComplete: string;
  hint?: string;
  optional?: boolean;
  /** Rich label for checkboxes (e.g. with links to the terms). */
  content?: ReactNode;
}

interface AuthFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: AuthField[];
  submitLabel: string;
  pendingLabel: string;
  next: string | null;
  /** Extra hidden inputs, e.g. a one-time token. */
  hidden?: Record<string, string>;
}

const clock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Milliseconds left of the lock, ticking once a second; 0 when there is none. */
function useLockCountdown(lockedUntil: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!lockedUntil || lockedUntil <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);
  return lockedUntil ? Math.max(0, lockedUntil - now) : 0;
}

/** Shared login / registration form. */
export function AuthForm({ action, fields, submitLabel, pendingLabel, next, hidden }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null });
  const lockLeft = useLockCountdown(state.lockedUntil);
  const locked = lockLeft > 0;
  return (
    <form action={formAction} className="grid gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      {/* Honeypot: invisible to people, filled in by bots. The server refuses submissions that have it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="mf_hp" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <fieldset disabled={locked} className="m-0 grid min-w-0 gap-5 border-0 p-0 disabled:opacity-60">
      {fields.map((field) =>
        field.type === "checkbox" ? (
          <label key={field.name} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name={field.name}
              required={!field.optional}
              className="mt-0.5 size-5 shrink-0 accent-burgundy"
            />
            <span>{field.content ?? field.label}</span>
          </label>
        ) : (
        <label key={field.name} className="block">
          <span className="field-label">{field.label}</span>
          <input
            name={field.name}
            type={field.type}
            required={!field.optional}
            autoComplete={field.autoComplete}
            defaultValue={field.type === "password" ? undefined : state.values?.[field.name]}
            className="field"
          />
          {field.hint && <span className="field-hint">{field.hint}</span>}
        </label>
        ),
      )}
      </fieldset>
      {state.captcha && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
          <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </>
      )}
      {locked && (
        <p className="alert-error" role="status">
          Prijava je privremeno zaključana zbog previše pogrešnih lozinki. Pokušajte ponovo za <strong className="tabular-nums">{clock(lockLeft)}</strong>.
        </p>
      )}
      {state.error && !locked && (
        <p className="alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-forest" role="status">
          {state.notice}
        </p>
      )}
      <button
        disabled={pending || locked}
        className="btn-primary mt-2 w-full"
      >
        {locked ? `Sačekajte ${clock(lockLeft)}` : pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
