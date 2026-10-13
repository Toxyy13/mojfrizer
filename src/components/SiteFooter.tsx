import Link from "next/link";
import { COMPANY, LEGAL_LINKS, isPlaceholder } from "@/lib/company";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="page flex flex-col gap-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Logo className="text-xl text-charcoal" />
          <span>Online zakazivanje za frizerske salone u Srbiji.</span>
        </div>
        <nav className="flex gap-5" aria-label="Podnožje">
          <Link href="/" className="hover:text-charcoal">
            Saloni
          </Link>
          <Link href="/nalog" className="hover:text-charcoal">
            Moj nalog
          </Link>
          <Link href="/admin" className="hover:text-charcoal">
            Prijava salona
          </Link>
        </nav>
      </div>
      <div className="page flex flex-col gap-3 border-t border-line py-6 text-xs text-muted">
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Pravne informacije">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-charcoal">
              {l.label}
            </Link>
          ))}
        </nav>
        <p>
          © {new Date().getFullYear()} mojfrizer.com
          {![COMPANY.name, COMPANY.pib, COMPANY.registryNumber, COMPANY.address].some(isPlaceholder) &&
            ` · ${COMPANY.name} · PIB ${COMPANY.pib} · MB ${COMPANY.registryNumber} · ${COMPANY.address}`}
          {!isPlaceholder(COMPANY.email) && ` · ${COMPANY.email}`}
        </p>
      </div>
    </footer>
  );
}
