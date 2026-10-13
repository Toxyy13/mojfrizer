import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { COMPANY, isPlaceholder } from "@/lib/company";

export const metadata: Metadata = {
  title: "Dodaj svoj salon · mojfrizer",
  description: "Nalog za salon otvaramo mi. Pozovite ili pišite i salon je online za nekoliko dana.",
};

export default function AddSalonPage() {
  const phone = isPlaceholder(COMPANY.phone) ? null : COMPANY.phone;
  const email = isPlaceholder(COMPANY.email) ? null : COMPANY.email;
  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1} className="page max-w-2xl py-12 sm:py-20">
        <p className="eyebrow">Za salone</p>
        <h1 className="mt-3 font-serif text-4xl sm:text-6xl">Dodaj svoj salon</h1>
        <p className="mt-5 text-lg text-muted">
          Nalog za salon otvaramo mi, da sve bude podešeno kako treba. Pozovite ili pišite, a vaš salon dobija stranicu sa online zakazivanjem, kalendar i podsetnike za mušterije.
        </p>
        <div className="card mt-10 grid gap-6 p-6 sm:p-8">
          {phone && (
            <div>
              <p className="eyebrow">Telefon</p>
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="mt-1 inline-block font-serif text-3xl hover:text-burgundy">{phone}</a>
            </div>
          )}
          {email && (
            <div>
              <p className="eyebrow">Email</p>
              <a href={`mailto:${email}`} className="mt-1 inline-block break-all font-serif text-3xl hover:text-burgundy">{email}</a>
            </div>
          )}
          {!phone && !email && <p className="text-muted">Kontakt podaci će uskoro biti ovde.</p>}
        </div>
        <p className="mt-6 text-sm text-muted">
          Već imate nalog salona? <Link href="/prijava" className="link">Prijavite se</Link>.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
