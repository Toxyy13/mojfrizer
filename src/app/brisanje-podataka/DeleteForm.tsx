"use client";

import { useActionState } from "react";
import type { FormState } from "../prijava/actions";
import { deleteMyAccount } from "./actions";

export function DeleteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteMyAccount, { error: null });
  return (
    <form action={action} className="card grid gap-4 p-5">
      <label className="block">
        <span className="field-label">Za potvrdu upišite OBRIŠI</span>
        <input name="confirm" required autoComplete="off" className="field" />
      </label>
      {state.error && (
        <p className="alert-error" role="alert">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Brišem…" : "Trajno obriši moj nalog"}
      </button>
    </form>
  );
}
