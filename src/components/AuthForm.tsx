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

/** Shared login / registration form. */
export function AuthForm({ action, fields, submitLabel, pendingLabel, next }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null });
  return (
    <form action={formAction} className="grid gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      {fields.map((field) => (
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
      ))}
      {state.error && (
        <p className="alert-error" role="alert">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="btn-primary mt-2 w-full"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
