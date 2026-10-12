import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { requestPasswordReset } from "../nalog/actions";

export const metadata: Metadata = { title: "Zaboravljena lozinka · mojfrizer" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Nalog"
      title="Zaboravljena lozinka"
      intro="Upišite email adresu naloga, poslaćemo vam link za novu lozinku."
      footer={
        <Link href="/prijava" className="link">
          ← Nazad na prijavu
        </Link>
      }
    >
      <AuthForm
        action={requestPasswordReset}
        next={null}
        submitLabel="Pošalji link"
        pendingLabel="Šaljem…"
        fields={[{ name: "email", label: "Email adresa", type: "email", autoComplete: "email" }]}
      />
    </AuthShell>
  );
}
