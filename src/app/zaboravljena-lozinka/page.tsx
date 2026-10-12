import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import { requestPasswordReset } from "../nalog/actions";

export const metadata: Metadata = { title: "Zaboravljena lozinka · mojfrizer" };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">Zaboravljena lozinka</h1>
        <p className="mt-6 text-neutral-600">Upišite email adresu naloga, poslaćemo vam link za novu lozinku.</p>
        <div className="mt-10">
          <AuthForm
            action={requestPasswordReset}
            next={null}
            submitLabel="Pošalji link"
            pendingLabel="Šaljem…"
            fields={[{ name: "email", label: "Email adresa", type: "email", autoComplete: "email" }]}
          />
        </div>
        <p className="mt-16 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
          <Link href="/prijava" className="text-burgundy underline underline-offset-4">
            Nazad na prijavu
          </Link>
        </p>
      </main>
    </>
  );
}
