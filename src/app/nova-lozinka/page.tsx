import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
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
    <AuthShell eyebrow="Nalog" title="Nova lozinka">
      {valid ? (
        <AuthForm
          action={resetPassword}
          next={null}
          hidden={{ token }}
          submitLabel="Sačuvaj lozinku"
          pendingLabel="Čuvam…"
          fields={[{ name: "password", label: "Nova lozinka", type: "password", autoComplete: "new-password", hint: "Bar 8 znakova" }]}
        />
      ) : (
        <p className="alert-error" role="alert">
          Link je istekao ili je već iskorišćen.{" "}
          <Link href="/zaboravljena-lozinka" className="font-medium underline underline-offset-4">
            Zatražite novi
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
