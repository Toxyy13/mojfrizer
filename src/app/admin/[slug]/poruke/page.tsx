import Link from "next/link";
import { requireSalonAccess } from "@/lib/access";
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
  const { salon } = await requireSalonAccess(slug);

  const [latest, unread] = await Promise.all([
    db.chatMessage.findMany({
      where: { salonId: salon.id },
      orderBy: { createdAt: "desc" },
      distinct: ["clientId"],
      take: 100,
      select: { text: true, fromSalon: true, createdAt: true, client: { select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } } } },
    }),
    db.chatMessage.groupBy({
      by: ["clientId"],
      where: { salonId: salon.id, fromSalon: false, readAt: null },
      _count: { _all: true },
    }),
  ]);
  const unreadBy = new Map(unread.map((u) => [u.clientId, u._count._all]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <ChatRefresh />
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{salon.name}</p>
      <h1 className="mt-4 font-serif text-5xl leading-none">Poruke</h1>
      <p className="mt-3 text-sm">
        <Link href={`/admin/${slug}`} className="underline underline-offset-4 hover:text-burgundy">
          ← Nazad na raspored
        </Link>
      </p>
      <ul className="mt-10 border-t border-neutral-200">
        {latest.length === 0 && <li className="py-6 text-neutral-500">Još niko nije pisao salonu.</li>}
        {latest.map((c) => {
          const count = unreadBy.get(c.client.id) ?? 0;
          return (
            <li key={c.client.id}>
              <Link
                href={`/admin/${slug}/poruke/${c.client.id}`}
                className="flex items-center justify-between gap-4 border-b border-neutral-200 py-5 transition-colors hover:text-burgundy"
              >
                <Avatar name={c.client.name} src={avatarUrl(c.client.id, c.client.avatar)} size={40} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-xl ${count > 0 ? "font-semibold" : ""}`}>{c.client.name}</span>
                  <span className="mt-1 block truncate text-sm text-neutral-500">
                    {c.fromSalon ? "Vi: " : ""}
                    {c.text}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm text-neutral-500">
                  {count > 0 && <span className="mr-3 bg-burgundy px-2 py-0.5 text-xs text-white">{count} nova</span>}
                  {c.client.phone ? formatPhone(c.client.phone) : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
