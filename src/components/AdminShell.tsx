import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/prijava/actions";
import { unreadForSalon } from "@/lib/chat";
import { Logo } from "./Logo";

export type AdminTab = "raspored" | "poruke" | "podesavanja";

interface AdminShellProps {
  salon: { id: string; name: string; slug: string; ownerId: string };
  user: { id: string; name: string };
  active: AdminTab;
  children: ReactNode;
}

/** Top bar and tabs shared by every salon admin page. */
export async function AdminShell({ salon, user, active, children }: AdminShellProps) {
  const unread = await unreadForSalon(salon.id);
  const tabs: Array<{ id: AdminTab; label: string; href: string; badge?: number }> = [
    { id: "raspored", label: "Raspored", href: `/admin/${salon.slug}` },
    { id: "poruke", label: "Poruke", href: `/admin/${salon.slug}/poruke`, badge: unread },
  ];
  if (salon.ownerId === user.id) tabs.push({ id: "podesavanja", label: "Podešavanja", href: `/admin/${salon.slug}/podesavanja` });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="page flex h-16 items-center gap-4">
          <Logo href={`/admin/${salon.slug}`} className="text-[22px]" />
          <span aria-hidden className="h-6 w-px bg-line" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{salon.name}</p>
            <p className="truncate text-xs text-muted">{user.name}</p>
          </div>
          <Link href={`/s/${salon.slug}`} className="btn-ghost btn-sm hidden sm:inline-flex">
            Javna stranica ↗
          </Link>
          <form action={logout}>
            <button className="btn-secondary btn-sm">Odjava</button>
          </form>
        </div>
        <nav className="page -mb-px flex gap-1 overflow-x-auto" aria-label="Admin">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === active ? "page" : undefined}
              className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm text-muted transition-colors hover:text-charcoal aria-[current=page]:border-burgundy aria-[current=page]:font-medium aria-[current=page]:text-charcoal"
            >
              {tab.label}
              {tab.badge ? <span className="badge bg-burgundy px-2 text-white">{tab.badge}</span> : null}
            </Link>
          ))}
          <Link href={`/s/${salon.slug}`} className="shrink-0 px-3 py-3 text-sm text-muted sm:hidden">
            Javna stranica ↗
          </Link>
        </nav>
      </header>
      <main className="page py-8 sm:py-10">{children}</main>
    </div>
  );
}
