import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { requestVerificationMail } from "../../nalog/actions";

export const metadata: Metadata = { title: "Pošalji ponovo mejl · mojfrizer" };

export default function ResendVerificationPage() {
  return (
    <AuthShell
      eyebrow="Nalog"
      title="Potvrda emaila"
      intro="Upišite email adresu naloga, poslaćemo vam novi link za potvrdu."
      footer={
        <Link href="/prijava" className="link">
          ← Nazad na prijavu
        </Link>
      }
    >
      <AuthForm
        action={requestVerificationMail}
        next={null}
        submitLabel="Pošalji mejl"
        pendingLabel="Šaljem…"
        fields={[{ name: "email", label: "Email adresa", type: "email", autoComplete: "email" }]}
      />
    </AuthShell>
  );
}
