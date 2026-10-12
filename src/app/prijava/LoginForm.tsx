"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const input =
  "mt-2 w-full border-b border-neutral-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-burgundy";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={action} className="mt-12 grid gap-8">
      <label className="block">
        <span className="text-sm text-neutral-600">Email</span>
        <input name="email" type="email" required autoComplete="username" className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-600">Lozinka</span>
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {state.error && (
        <p className="border-l-2 border-burgundy pl-4 text-burgundy" role="alert">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="justify-self-start bg-burgundy px-10 py-4 text-sm uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark disabled:opacity-40"
      >
        {pending ? "Prijavljujem…" : "Prijava"}
      </button>
    </form>
  );
}
