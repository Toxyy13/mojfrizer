import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import { peekToken } from "@/lib/emailTokens";
import { resetPassword } from "../nalog/actions";

export const metadata: Metadata = { title: "Nova lozinka · mojfrizer" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function NewPasswordPage({ searchParams }: PageProps) {
  const token = (await searchParams).token ?? "";
  const valid = token ? await peekToken(token, "RESET_PASSWORD") : null;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">Nova lozinka</h1>
        {valid ? (
          <div className="mt-10">
            <AuthForm
              action={resetPassword}
              next={null}
              hidden={{ token }}
              submitLabel="Sačuvaj lozinku"
              pendingLabel="Čuvam…"
              fields={[
                { name: "password", label: "Nova lozinka", type: "password", autoComplete: "new-password", hint: "Bar 8 znakova" },
              ]}
            />
          </div>
        ) : (
          <p className="mt-8 border-l-2 border-burgundy pl-4 text-burgundy" role="alert">
            Link je istekao ili je već iskorišćen.{" "}
            <Link href="/zaboravljena-lozinka" className="underline underline-offset-4">
              Zatražite novi
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
