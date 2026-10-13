import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { isValidUnsubscribe, unsubscribeUser } from "@/lib/unsubscribe";

export const metadata: Metadata = { title: "Odjava sa mejlova · mojfrizer", robots: { index: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ u?: string; t?: string; potvrda?: string }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { u = "", t = "", potvrda } = await searchParams;
  const valid = isValidUnsubscribe(u, t);

  async function confirm(): Promise<void> {
    "use server";
    if (isValidUnsubscribe(u, t)) await unsubscribeUser(u);
    redirect(`/odjava-mejlova?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}&potvrda=1`);
  }

  return (
    <AuthShell eyebrow="Mejlovi" title={potvrda ? "Odjavljeni ste" : "Odjava sa mejlova"}>
      {!valid && <p className="alert-error">Link nije ispravan. Mejlove možete isključiti i u svom nalogu, na stranici „Moji podaci”.</p>}
      {valid && potvrda && (
        <p className="text-sm">
          Gotovo. Više vam ne šaljemo podsetnike za termine ni obaveštenja sa liste čekanja ni zamolbe za ocenu. Mejlove o nalogu (potvrda emaila, nova
          lozinka) i dalje šaljemo kada ih sami zatražite. Možete ih ponovo uključiti u nalogu.
        </p>
      )}
      {valid && !potvrda && (
        <form action={confirm} className="grid gap-4">
          <p className="text-sm">Da li želite da prestanete da dobijate podsetnike za termine, obaveštenja sa liste čekanja i zamolbe za ocenu?</p>
          <button className="btn-primary w-full">Da, odjavi me</button>
          <Link href="/" className="btn-ghost w-full">
            Ne, ostavi kako jeste
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
