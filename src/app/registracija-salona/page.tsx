import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { TermsLabel } from "@/components/TermsConsent";
import { getSessionUser } from "@/lib/auth";
import { registerSalon } from "./actions";

export const metadata: Metadata = {
  title: "Otvorite salon · mojfrizer",
  description: "Online zakazivanje za vaš frizerski salon: stranica salona, kalendar, podsetnici i karton mušterija.",
};

export default async function SalonSignUpPage() {
  const user = await getSessionUser();
  const salonFields = [
    { name: "salonName", label: "Naziv salona", type: "text", autoComplete: "organization" },
    { name: "city", label: "Grad", type: "text", autoComplete: "address-level2" },
    { name: "address", label: "Adresa", type: "text", autoComplete: "street-address", hint: "Npr. Nikole Pašića 27" },
    { name: "phone", label: "Telefon salona (nije obavezno)", type: "tel", autoComplete: "tel", optional: true },
  ] as const;
  const ownerFields = [
    { name: "name", label: "Vaše ime i prezime", type: "text", autoComplete: "name" },
    { name: "email", label: "Email adresa", type: "email", autoComplete: "email", hint: "Za prijavu i obaveštenja o terminima." },
    { name: "password", label: "Lozinka", type: "password", autoComplete: "new-password", hint: "Bar 8 znakova" },
  ] as const;

  return (
    <AuthShell
      eyebrow="Za salone"
      title="Otvorite salon"
      intro="Za dva minuta dobijate stranicu salona sa online zakazivanjem. Cenovnik i radno vreme unosite odmah posle."
      footer={
        user ? (
          <>Salon će biti vezan za nalog {user.email ?? user.name}.</>
        ) : (
          <>
            Već imate nalog?{" "}
            <Link href="/prijava?next=/registracija-salona" className="font-medium text-burgundy hover:underline">
              Prijavite se
            </Link>{" "}
            pa otvorite salon.
          </>
        )
      }
    >
      <AuthForm
        action={registerSalon}
        next={null}
        submitLabel="Otvori salon"
        pendingLabel="Otvaram salon…"
        fields={[
          ...(user ? salonFields : [...salonFields, ...ownerFields]),
          ...(user ? [] : [{ name: "terms", label: "Uslovi", type: "checkbox", autoComplete: "off", content: <TermsLabel /> } as const]),
        ]}
      />
    </AuthShell>
  );
}
