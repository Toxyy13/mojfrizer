import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { avatarUrl } from "@/lib/avatar";
import { ChatThread } from "@/components/ChatThread";
import { requireSalonAccess } from "@/lib/access";
import { loadConversation, markRead } from "@/lib/chat";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { sendToClient } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; clientId: string }>;
}

export default async function AdminConversation({ params }: PageProps) {
  const { slug, clientId } = await params;
  const { salon, user } = await requireSalonAccess(slug);

  // The conversation must belong to this salon; otherwise another tenant's customer could be opened by id.
  const messages = await loadConversation(salon.id, clientId);
  if (messages.length === 0) notFound();
  const client = await db.user.findUnique({ where: { id: clientId }, select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } } });
  if (!client) notFound();
  await markRead(salon.id, clientId, true);

  return (
    <AdminShell salon={salon} user={user} active="poruke">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3">
          <Link href={`/admin/${slug}/poruke`} className="btn-ghost size-11 shrink-0 p-0 text-lg" aria-label="Sve poruke">
            ←
          </Link>
          <Avatar name={client.name} src={avatarUrl(client.id, client.avatar)} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-2xl leading-tight sm:text-3xl">{client.name}</h1>
            {client.phone && <p className="text-sm text-muted">{formatPhone(client.phone)}</p>}
          </div>
          {client.phone && (
            <a href={`tel:${client.phone}`} className="btn-secondary btn-sm">
              Pozovi
            </a>
          )}
        </header>
        <div className="mt-6">
          <ChatThread messages={messages} viewerIsSalon send={sendToClient.bind(null, slug, clientId)} emptyHint="" />
        </div>
      </div>
    </AdminShell>
  );
}
