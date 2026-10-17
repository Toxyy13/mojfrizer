"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "../actions";

interface ProfileFormProps {
  name: string;
  phone: string;
}

export function ProfileForm({ name, phone }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, { error: null });
  return (
    <form action={action} className="mt-8 grid gap-5">
      <label className="block">
        <span className="field-label">Ime i prezime</span>
        <input name="name" required autoComplete="name" defaultValue={state.values?.name ?? name} className="field" />
      </label>
      <label className="block">
        <span className="field-label">Broj telefona (nije obavezno)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={state.values?.phone ?? phone}
          placeholder="06x xxx xxxx"
          className="field"
        />
        <span className="field-hint">
          Salon vas zove na ovaj broj ako se nešto desi sa terminom.
        </span>
      </label>
      {state.error && (
        <p className="alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-forest" role="status">
          Sačuvano.
        </p>
      )}
      <button
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? "Čuvam…" : "Sačuvaj"}
      </button>
    </form>
  );
}
