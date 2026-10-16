import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getSessionUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { changePassword } from "../actions";

export const metadata: Metadata = { title: "Promena lozinke · mojfrizer", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/nalog/lozinka");
  const user = await systemDb.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
  const hasPassword = Boolean(user?.passwordHash);

  return (
    <AuthShell
      eyebrow="Moj nalog"
      title="Promena lozinke"
      intro={hasPassword ? "Za promenu je potrebna trenutna lozinka." : undefined}
      footer={
        <Link href="/nalog" className="link">
          ← Nazad na nalog
        </Link>
      }
    >
      {hasPassword ? (
        <AuthForm
          action={changePassword}
          next={null}
          submitLabel="Sačuvaj lozinku"
          pendingLabel="Čuvam…"
          fields={[
            { name: "current", label: "Trenutna lozinka", type: "password", autoComplete: "current-password" },
            { name: "password", label: "Nova lozinka", type: "password", autoComplete: "new-password", hint: "Bar 8 znakova" },
          ]}
        />
      ) : (
        <p className="text-sm">
          Prijavljeni ste preko Google naloga i nemate lozinku. Ako želite da se prijavljujete i emailom,{" "}
          <Link href="/zaboravljena-lozinka" className="link">
            postavite lozinku ovde
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
