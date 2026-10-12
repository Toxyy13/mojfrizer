"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "../actions";

interface ProfileFormProps {
  name: string;
  phone: string;
}

const input =
  "mt-2 w-full border-b border-neutral-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-burgundy";

export function ProfileForm({ name, phone }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, { error: null });
  return (
    <form action={action} className="mt-10 grid gap-8">
      <label className="block">
        <span className="text-sm text-neutral-600">Ime i prezime</span>
        <input name="name" required autoComplete="name" defaultValue={state.values?.name ?? name} className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-600">Broj telefona</span>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          defaultValue={state.values?.phone ?? phone}
          placeholder="06x xxx xxxx"
          className={input}
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Salon vas zove na ovaj broj ako se nešto desi sa terminom.
        </span>
      </label>
      {state.error && (
        <p className="border-l-2 border-burgundy pl-4 text-burgundy" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="border-l-2 border-forest pl-4 text-forest" role="status">
          Sačuvano.
        </p>
      )}
      <button
        disabled={pending}
        className="justify-self-start bg-burgundy px-10 py-4 text-sm uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark disabled:opacity-40"
      >
        {pending ? "Čuvam…" : "Sačuvaj"}
      </button>
    </form>
  );
}
