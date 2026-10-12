import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
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
    <AuthShell
      eyebrow="Dobro došli nazad"
      title="Prijava"
      footer={
        <>
          Nemate nalog?{" "}
          <Link href={registerHref} className="font-medium text-burgundy hover:underline">
            Registrujte se besplatno
          </Link>
        </>
      }
    >
      {params.greska === "google" && (
        <p className="alert-error mb-6" role="alert">
          Prijava preko Google naloga nije uspela. Pokušajte ponovo ili se prijavite emailom.
        </p>
      )}
      <GoogleButton next={next} />
      <AuthForm
        action={login}
        next={next}
        submitLabel="Prijavi se"
        pendingLabel="Prijavljujem…"
        fields={[
          { name: "login", label: "Email adresa", type: "text", autoComplete: "username" },
          { name: "password", label: "Lozinka", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthShell>
  );
}
