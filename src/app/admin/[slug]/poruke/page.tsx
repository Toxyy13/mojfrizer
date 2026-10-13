import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireSalonAccess } from "@/lib/access";
import { urgentClientIdsForStaff } from "@/lib/urgentChat";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { Avatar } from "@/components/Avatar";
import { avatarUrl } from "@/lib/avatar";
import { ChatRefresh } from "@/components/ChatRefresh";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminInbox({ params }: PageProps) {
  const { slug } = await params;
  const { salon, user, staffWorkerId } = await requireSalonAccess(slug);
  // Staff logins only see customers with an open urgent request for them or for anyone.
  const staffClientIds = staffWorkerId ? await urgentClientIdsForStaff(salon.id, staffWorkerId) : null;
  const scope = staffClientIds ? { clientId: { in: staffClientIds } } : {};

  const [latest, unread] = await Promise.all([
    db.chatMessage.findMany({
      where: { salonId: salon.id, ...scope },
      orderBy: { createdAt: "desc" },
      distinct: ["clientId"],
      take: 100,
      select: { text: true, fromSalon: true, createdAt: true, client: { select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } } } },
    }),
    db.chatMessage.groupBy({
      by: ["clientId"],
      where: { salonId: salon.id, fromSalon: false, readAt: null, ...scope },
      _count: { _all: true },
    }),
  ]);
  const unreadBy = new Map(unread.map((u) => [u.clientId, u._count._all]));

  return (
    <AdminShell salon={salon} user={user} active="poruke">
      <ChatRefresh />
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-3xl sm:text-4xl">Poruke</h1>
        <p className="mt-1 text-sm text-muted">{staffClientIds ? "Hitne rezervacije upućene vama ili „Bilo ko”. Nove poruke se pojavljuju same." : "Mušterije pišu sa stranice salona. Nove poruke se pojavljuju same."}</p>
        <ul className="card mt-6 divide-y divide-line overflow-hidden">
          {latest.length === 0 && <li className="p-8 text-center text-muted">{staffClientIds ? "Nema otvorenih hitnih rezervacija za vas." : "Još niko nije pisao salonu."}</li>}
          {latest.map((c) => {
            const count = unreadBy.get(c.client.id) ?? 0;
            return (
              <li key={c.client.id}>
                <Link
                  href={`/admin/${slug}/poruke/${c.client.id}`}
                  className={`flex items-center gap-4 p-4 transition-colors hover:bg-cream ${count > 0 ? "bg-burgundy-soft/40" : ""}`}
                >
                  <Avatar name={c.client.name} src={avatarUrl(c.client.id, c.client.avatar)} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${count > 0 ? "font-semibold" : "font-medium"}`}>{c.client.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {c.fromSalon ? "Vi: " : ""}
                      {c.text}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted">
                    {count > 0 && <span className="badge mb-1 bg-burgundy text-white">{count} nova</span>}
                    <span className="block">{c.client.phone ? formatPhone(c.client.phone) : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </AdminShell>
  );
}
