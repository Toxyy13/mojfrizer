import type { Metadata } from "next";
import Link from "next/link";
import { ErrorPanel } from "@/components/ErrorPanel";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Pristup nije dozvoljen · mojfrizer", robots: { index: false } };

/** 403: the person is known but may not open this page (e.g. another salon's admin area). */
export default function ForbiddenPage() {
  return (
    <>
      <ErrorPanel
        code="403"
        title="Pristup nije dozvoljen"
        bar
        actions={
          <>
            <Link href="/" className="btn-primary">
              Na početnu
            </Link>
            <Link href="/prijava" className="btn-secondary">
              Prijava drugim nalogom
            </Link>
          </>
        }
      >
        <p>Ovaj nalog nema pravo da otvori ovu stranicu. Ako mislite da je ovo greška, prijavite se nalogom koji ima pristup.</p>
      </ErrorPanel>
      <SiteFooter />
    </>
  );
}
