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
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="page flex h-16 items-center gap-4">
          <Logo href="/razvoj" className="text-[22px]" />
          <span aria-hidden className="h-6 w-px bg-line" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">Platforma</p>
            <p className="truncate text-xs text-muted">{user.name}</p>
          </div>
          <form action={logout}>
            <button className="btn-secondary btn-sm">Odjava</button>
          </form>
        </div>
        <nav className="page -mb-px flex gap-1 overflow-x-auto" aria-label="Razvoj">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === active ? "page" : undefined}
              className="flex shrink-0 items-center border-b-2 border-transparent px-3 py-3 text-sm text-muted transition-colors hover:text-charcoal aria-[current=page]:border-burgundy aria-[current=page]:font-medium aria-[current=page]:text-charcoal"
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
