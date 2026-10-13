import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { systemDb } from "@/lib/db";
import { consumeToken } from "@/lib/emailTokens";

export const metadata: Metadata = { title: "Potvrda emaila · mojfrizer" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/** Opened from the link in the verification mail. */
export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const token = (await searchParams).token ?? "";
  let ok = false;
  if (token) {
    try {
      const used = await consumeToken(token, "VERIFY_EMAIL");
      if (used) {
        await systemDb.user.updateMany({ where: { id: used.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
        ok = true;
      }
    } catch (error) {
      console.error(error);
    }
  }
  return (
    <AuthShell eyebrow="Nalog" title={ok ? "Email potvrđen" : "Link ne važi"}>
      <p className={`rounded-xl px-4 py-3 text-sm ${ok ? "bg-forest-soft text-forest" : "bg-burgundy-soft text-burgundy"}`}>
        {ok
          ? "Hvala! Od sada vam šaljemo podsetnike za termine na ovu adresu."
          : "Link je istekao ili je već iskorišćen. Novi možete da zatražite u svom nalogu."}
      </p>
      <Link href="/nalog" className="btn-primary mt-6 w-full">
        Moj nalog
      </Link>
    </AuthShell>
  );
}
