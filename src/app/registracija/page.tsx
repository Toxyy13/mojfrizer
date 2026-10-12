import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/landing";
import { register } from "../nalog/actions";

export const metadata: Metadata = { title: "Registracija · mojfrizer" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const next = safeNextPath((await searchParams).next);
  if (await getSessionUser()) redirect(next ?? "/nalog");

  const loginHref = next ? `/prijava?next=${encodeURIComponent(next)}` : "/prijava";
  return (
    <AuthShell
      eyebrow="Besplatan nalog"
      title="Registracija"
      intro="Sa nalogom vidite svoje termine i odmah dolazite na omiljeni salon."
      footer={
        <>
          Već imate nalog?{" "}
          <Link href={loginHref} className="font-medium text-burgundy hover:underline">
            Prijavite se
          </Link>
          <span className="mt-2 block">
            Imate salon?{" "}
            <Link href="/registracija-salona" className="font-medium text-burgundy hover:underline">
              Otvorite ga na mojfrizer.com
            </Link>
          </span>
        </>
      }
    >
      <GoogleButton next={next} />
      <AuthForm
        action={register}
        next={next}
        submitLabel="Napravi nalog"
        pendingLabel="Pravim nalog…"
        fields={[
          { name: "name", label: "Ime i prezime", type: "text", autoComplete: "name" },
          { name: "email", label: "Email adresa", type: "email", autoComplete: "email", hint: "Na nju stiže podsetnik za termin." },
          { name: "phone", label: "Broj telefona (nije obavezno)", type: "tel", autoComplete: "tel", hint: "Npr. 064 123 4567", optional: true },
          { name: "password", label: "Lozinka", type: "password", autoComplete: "new-password", hint: "Bar 8 znakova" },
        ]}
      />
    </AuthShell>
  );
}
