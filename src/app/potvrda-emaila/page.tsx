import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { peekToken } from "@/lib/emailTokens";
import { confirmEmail } from "../nalog/actions";

export const metadata: Metadata = { title: "Potvrda emaila · mojfrizer" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Opened from the link in the verification mail. Opening it only looks at the token; the button uses it up,
 * so mail scanners that open links can't burn it before the person does.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const token = (await searchParams).token ?? "";
  let valid = false;
  try {
    valid = !!token && !!(await peekToken(token, "VERIFY_EMAIL"));
  } catch (error) {
    console.error(error);
  }
  return (
    <AuthShell eyebrow="Nalog" title={valid ? "Potvrdite email" : "Link ne važi"}>
      {valid ? (
        <form action={confirmEmail}>
          <input type="hidden" name="token" value={token} />
          <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-forest">Još jedan klik i nalog je spreman.</p>
          <button className="btn-primary mt-6 w-full">Potvrdi email i prijavi me</button>
        </form>
      ) : (
        <>
          <p className="rounded-xl bg-burgundy-soft px-4 py-3 text-sm text-burgundy">Link je istekao ili je već iskorišćen. Zatražite novi mejl.</p>
          <Link href="/potvrda-emaila/ponovo" className="btn-primary mt-6 w-full">
            Pošalji ponovo mejl
          </Link>
          <Link href="/prijava" className="btn-secondary mt-3 w-full">
            Prijava
          </Link>
        </>
      )}
    </AuthShell>
  );
}
