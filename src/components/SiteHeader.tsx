import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { Logo } from "./Logo";

/** Sticky top bar shared by all customer-facing pages. */
export async function SiteHeader() {
  const user = await getSessionUser();
  const firstName = user?.name.split(" ")[0] ?? "";
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <nav className="page flex h-16 items-center justify-between gap-4" aria-label="Glavna navigacija">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/#saloni" className="btn-ghost hidden sm:inline-flex">
            Saloni
          </Link>
          {user ? (
            <Link href={user.role === "CLIENT" ? "/nalog" : user.role === "DEVELOPER" ? "/razvoj" : "/admin"} className="btn-secondary btn-sm">
              <span
                aria-hidden
                className="grid size-6 place-items-center rounded-full bg-burgundy text-[11px] font-semibold text-white"
              >
                {firstName.charAt(0).toUpperCase()}
              </span>
              {user.role === "CLIENT" ? "Moj nalog" : user.role === "DEVELOPER" ? "Razvoj" : "Moj salon"}
            </Link>
          ) : (
            <>
              <Link href="/prijava" className="btn-ghost">
                Prijava
              </Link>
              <Link href="/registracija" className="btn-primary btn-sm hidden sm:inline-flex">
                Napravi nalog
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
