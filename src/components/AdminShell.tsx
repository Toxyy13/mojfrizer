import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/prijava/actions";
import { unreadForSalon } from "@/lib/chat";
import { AssistantWidget } from "./AssistantWidget";
import { Logo } from "./Logo";

type AdminTab = "raspored" | "poruke" | "musterije" | "izvestaji" | "podesavanja" | "qr";

interface AdminShellProps {
  salon: { id: string; name: string; slug: string; ownerId: string };
  user: { id: string; name: string };
  active: AdminTab;
  children: ReactNode;
}

/** Top bar and tabs shared by every salon admin page. */
export async function AdminShell({ salon, user, active, children }: AdminShellProps) {
  const isOwner = salon.ownerId === user.id;
  const tabs: Array<{ id: AdminTab; label: string; href: string; badge?: number }> = [
    { id: "raspored", label: "Raspored", href: `/admin/${salon.slug}` },
  ];
  // Staff logins see their own schedule and the urgent chats addressed to them.
  if (!isOwner) tabs.push({ id: "poruke", label: "Hitne poruke", href: `/admin/${salon.slug}/poruke` });
  if (isOwner) {
    const unread = await unreadForSalon(salon.id);
    tabs.push({ id: "poruke", label: "Poruke", href: `/admin/${salon.slug}/poruke`, badge: unread });
    tabs.push({ id: "musterije", label: "Mušterije", href: `/admin/${salon.slug}/musterije` });
    tabs.push({ id: "qr", label: "QR kod", href: `/admin/${salon.slug}/qr` });
    tabs.push({ id: "izvestaji", label: "Izveštaji", href: `/admin/${salon.slug}/izvestaji` });
    tabs.push({ id: "podesavanja", label: "Podešavanja", href: `/admin/${salon.slug}/podesavanja` });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md print:hidden">
        <div className="page flex h-16 items-center gap-4">
          <Logo href={`/admin/${salon.slug}`} className="text-[22px]" />
          <span aria-hidden className="h-6 w-px bg-line" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{isOwner ? salon.name : `${salon.name} / ${user.name}`}</p>
            <p className="truncate text-xs text-muted">{isOwner ? user.name : "Radnik"}</p>
          </div>
          <Link href={`/s/${salon.slug}`} className="btn-ghost btn-sm hidden sm:inline-flex">
            Javna stranica ↗
          </Link>
          <Link href="/nalog/lozinka" className="btn-ghost btn-sm hidden sm:inline-flex">
            Lozinka
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
      <main id="sadrzaj" tabIndex={-1} className="page py-8 sm:py-10">{children}</main>
      {isOwner && <AssistantWidget slug={salon.slug} salonName={salon.name} admin />}
    </div>
  );
}
