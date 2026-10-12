import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/landing";
import { register } from "../account/actions";

export const metadata: Metadata = { title: "Registracija · mojfrizer" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const next = safeNextPath((await searchParams).next);
  if (await getSessionUser()) redirect(next ?? "/account");

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">Registracija</h1>
        <p className="mt-6 text-neutral-600">
          Sa nalogom vidite svoje termine i odmah dolazite na omiljeni salon.
        </p>
        <AuthForm
          action={register}
          next={next}
          submitLabel="Napravi nalog"
          pendingLabel="Pravim nalog…"
          fields={[
            { name: "name", label: "Ime i prezime", type: "text", autoComplete: "name" },
            { name: "phone", label: "Broj telefona", type: "tel", autoComplete: "tel", hint: "Npr. 064 123 4567" },
            { name: "password", label: "Lozinka", type: "password", autoComplete: "new-password", hint: "Bar 8 znakova" },
          ]}
        />
        <p className="mt-16 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
          Već imate nalog?{" "}
          <Link href={loginHref} className="text-burgundy underline underline-offset-4">
            Prijavite se
          </Link>
        </p>
      </main>
    </>
  );
}
