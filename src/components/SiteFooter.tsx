import Link from "next/link";
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
            Za salone
          </Link>
        </nav>
      </div>
    </footer>
  );
}
