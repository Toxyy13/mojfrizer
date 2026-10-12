"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/prijava/actions";

interface AuthField {
  name: string;
  label: string;
  type: "text" | "tel" | "email" | "password";
  autoComplete: string;
  hint?: string;
  optional?: boolean;
}

interface AuthFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: AuthField[];
  submitLabel: string;
  pendingLabel: string;
  next: string | null;
}

const input =
  "mt-2 w-full border-b border-neutral-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-burgundy";

/** Shared login / registration form. */
export function AuthForm({ action, fields, submitLabel, pendingLabel, next }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null });
  return (
    <form action={formAction} className="mt-12 grid gap-8">
      {next && <input type="hidden" name="next" value={next} />}
      {fields.map((field) => (
        <label key={field.name} className="block">
          <span className="text-sm text-neutral-600">{field.label}</span>
          <input
            name={field.name}
            type={field.type}
            required={!field.optional}
            autoComplete={field.autoComplete}
            defaultValue={field.type === "password" ? undefined : state.values?.[field.name]}
            className={input}
          />
          {field.hint && <span className="mt-1 block text-xs text-neutral-500">{field.hint}</span>}
        </label>
      ))}
      {state.error && (
        <p className="border-l-2 border-burgundy pl-4 text-burgundy" role="alert">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="justify-self-start bg-burgundy px-10 py-4 text-sm uppercase tracking-[0.2em] text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-burgundy-dark disabled:opacity-40"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
