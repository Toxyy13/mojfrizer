"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createSalonAccount, type CreateSalonState } from "../../actions";

const FIELDS = [
  { name: "salonName", label: "Naziv salona", type: "text", auto: "off" },
  { name: "city", label: "Grad", type: "text", auto: "off" },
  { name: "address", label: "Adresa", type: "text", auto: "off", hint: "Npr. Nikole Pašića 27" },
  { name: "phone", label: "Telefon salona (nije obavezno)", type: "tel", auto: "off", optional: true },
  { name: "ownerName", label: "Ime i prezime vlasnika", type: "text", auto: "off" },
  { name: "ownerEmail", label: "Email vlasnika", type: "email", auto: "off", hint: "Ovim mejlom se vlasnik prijavljuje." },
  { name: "password", label: "Privremena lozinka (nije obavezno)", type: "text", auto: "off", optional: true, hint: "Ostavite prazno da je sistem izmisli. Vlasnik je posle menja preko „Zaboravljena lozinka”." },
] as const;

export function NewSalonForm() {
  const [state, formAction, pending] = useActionState<CreateSalonState, FormData>(createSalonAccount, { error: null });
  if (state.created) {
    const c = state.created;
    return (
      <div className="card grid gap-4 p-6" role="status">
        <h2 className="font-serif text-2xl">Salon „{c.name}” je napravljen</h2>
        <dl className="grid gap-2 text-sm">
          <div><dt className="eyebrow">Prijava vlasnika</dt><dd className="mt-1 font-medium">{c.ownerEmail}</dd></div>
          {c.tempPassword ? (
            <div>
              <dt className="eyebrow">Privremena lozinka (prikazuje se samo sada)</dt>
              <dd className="mt-1 font-mono text-base">{c.tempPassword}</dd>
            </div>
          ) : (
            <div><dt className="eyebrow">Lozinka</dt><dd className="mt-1">Vlasnik već ima nalog i koristi svoju lozinku.</dd></div>
          )}
        </dl>
        <div className="flex flex-wrap gap-3">
          <Link href={`/razvoj/saloni/${c.slug}`} className="btn-primary">Otvori salon</Link>
          <Link href="/razvoj/saloni/novi" className="btn-secondary">Dodaj još jedan</Link>
        </div>
      </div>
    );
  }
  return (
    <form action={formAction} className="card grid gap-5 p-6">
      {FIELDS.map((f) => (
        <label key={f.name} className="block">
          <span className="field-label">{f.label}</span>
          <input
            name={f.name}
            type={f.type}
            required={!("optional" in f)}
            autoComplete={f.auto}
            defaultValue={state.values?.[f.name]}
            className="field"
          />
          {"hint" in f && <span className="field-hint">{f.hint}</span>}
        </label>
      ))}
      {state.error && <p className="alert-error" role="alert">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">{pending ? "Pravim salon…" : "Napravi salon"}</button>
    </form>
  );
}
