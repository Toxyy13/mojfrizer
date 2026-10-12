import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getSessionUser();
  const link = "transition-colors duration-300 hover:text-burgundy";
  return (
    <header className="border-b border-neutral-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 text-sm" aria-label="Glavna navigacija">
        <Link href="/" className="font-serif text-2xl">
          mojfrizer
        </Link>
        <div className="flex items-center gap-6 text-neutral-600">
          {user ? (
            <Link href="/nalog" className={link}>
              Moj nalog
            </Link>
          ) : (
            <Link href="/prijava" className={link}>
              Prijava
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
