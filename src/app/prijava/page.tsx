import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { landingPathFor, safeNextPath } from "@/lib/landing";
import { login } from "./actions";

export const metadata: Metadata = { title: "Prijava · mojfrizer" };

interface PageProps {
  searchParams: Promise<{ next?: string; greska?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getSessionUser();
  if (user) redirect(next ?? (await landingPathFor(user)));

  const registerHref = next ? `/registracija?next=${encodeURIComponent(next)}` : "/registracija";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">Prijava</h1>
        {params.greska === "google" && (
          <p className="mt-8 border-l-2 border-burgundy pl-4 text-burgundy" role="alert">
            Prijava preko Google naloga nije uspela. Pokušajte ponovo ili se prijavite emailom.
          </p>
        )}
        <GoogleButton next={next} />
        <AuthForm
          action={login}
          next={next}
          submitLabel="Prijava"
          pendingLabel="Prijavljujem…"
          fields={[
            { name: "login", label: "Email adresa", type: "text", autoComplete: "username" },
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
