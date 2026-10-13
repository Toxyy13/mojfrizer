"use client";

import { useActionState, type ReactNode } from "react";
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

/** Shared login / registration form. */
export function AuthForm({ action, fields, submitLabel, pendingLabel, next, hidden }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null });
  return (
    <form action={formAction} className="grid gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {fields.map((field) =>
        field.type === "checkbox" ? (
          <label key={field.name} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name={field.name}
              required={!field.optional}
              defaultChecked={false}
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
      {state.error && (
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
        disabled={pending}
        className="btn-primary mt-2 w-full"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
