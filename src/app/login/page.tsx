import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { landingPathFor, safeNextPath } from "@/lib/landing";
import { login } from "../account/actions";

export const metadata: Metadata = { title: "Prijava · mojfrizer" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const next = safeNextPath((await searchParams).next);
  const user = await getSessionUser();
  if (user) redirect(next ?? (await landingPathFor(user.id)));

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">Prijava</h1>
        <AuthForm
          action={login}
          next={next}
          submitLabel="Prijava"
          pendingLabel="Prijavljujem…"
          fields={[
            { name: "login", label: "Broj telefona", type: "text", autoComplete: "username", hint: "Saloni se prijavljuju email adresom." },
            { name: "password", label: "Lozinka", type: "password", autoComplete: "current-password" },
          ]}
        />
        <p className="mt-16 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
          Nemate nalog?{" "}
          <Link href={registerHref} className="text-burgundy underline underline-offset-4">
            Registrujte se
          </Link>
        </p>
      </main>
    </>
  );
}
