import type { Metadata } from "next";
import Link from "next/link";
import { ErrorPanel } from "@/components/ErrorPanel";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Stranica ne postoji · mojfrizer", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <ErrorPanel
        code="404"
        title="Stranica ne postoji"
        bar
        actions={
          <>
            <Link href="/" className="btn-primary">
              Na početnu
            </Link>
            <Link href="/#saloni" className="btn-secondary">
              Pronađi salon
            </Link>
          </>
        }
      >
        <p>Link je pogrešan ili je stranica uklonjena. Proverite adresu ili potražite salon sa početne strane.</p>
      </ErrorPanel>
      <SiteFooter />
    </>
  );
}
