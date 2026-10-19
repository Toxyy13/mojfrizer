import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/prijava/actions";
import { Logo } from "./Logo";

interface DeveloperShellProps {
  user: { name: string };
  active: "pregled" | "novi";
  children: ReactNode;
}

/** Top bar and tabs shared by every platform (developer) page. */
export function DeveloperShell({ user, active, children }: DeveloperShellProps) {
  const tabs = [
    { id: "pregled", label: "Pregled", href: "/razvoj" },
    { id: "novi", label: "Novi salon", href: "/razvoj/saloni/novi" },
  ] as const;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 bg-charcoal text-cream">
        <div className="page flex h-16 items-center gap-4">
          <Logo dark href="/razvoj" className="text-[22px]" />
          <span aria-hidden className="h-6 w-px bg-cream/30" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">Platforma</p>
            <p className="truncate text-xs text-cream/65">{user.name}</p>
          </div>
          <Link href="/nalog/lozinka" className="btn-ghost btn-sm !text-cream/80 hover:!bg-cream/10 hover:!text-cream hidden sm:inline-flex">
            Lozinka
          </Link>
          <form action={logout}>
            <button className="btn-secondary btn-sm !border-0 !bg-white/10 !text-cream hover:!bg-white/20">Odjava</button>
          </form>
        </div>
        <nav className="page -mb-1 flex gap-1 overflow-x-auto pt-1" aria-label="Razvoj">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === active ? "page" : undefined}
              className="flex shrink-0 items-center rounded-t-xl px-4 py-2.5 text-sm font-medium text-cream/70 transition-colors hover:text-cream aria-[current=page]:bg-cream aria-[current=page]:text-charcoal"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="sadrzaj" tabIndex={-1} className="page py-8">
        {children}
      </main>
    </div>
  );
}
