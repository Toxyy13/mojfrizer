import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { db } from "@/lib/db";
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
        await db.user.updateMany({ where: { id: used.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
        ok = true;
      }
    } catch (error) {
      console.error(error);
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">{ok ? "Email potvrđen" : "Link ne važi"}</h1>
        <p className="mt-6 text-neutral-600">
          {ok
            ? "Hvala! Od sada vam šaljemo podsetnike za termine na ovu adresu."
            : "Link je istekao ili je već iskorišćen. Novi možete da zatražite u svom nalogu."}
        </p>
        <p className="mt-10 text-sm">
          <Link href="/nalog" className="text-burgundy underline underline-offset-4">
            Moj nalog
          </Link>
        </p>
      </main>
    </>
  );
}
