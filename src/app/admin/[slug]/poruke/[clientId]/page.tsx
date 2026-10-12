import Link from "next/link";
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
  const { salon } = await requireSalonAccess(slug);

  // The conversation must belong to this salon; otherwise another tenant's customer could be opened by id.
  const messages = await loadConversation(salon.id, clientId);
  if (messages.length === 0) notFound();
  const client = await db.user.findUnique({ where: { id: clientId }, select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } } });
  if (!client) notFound();
  await markRead(salon.id, clientId, true);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{salon.name}</p>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={client.name} src={avatarUrl(client.id, client.avatar)} size={56} />
        <h1 className="font-serif text-5xl leading-none">{client.name}</h1>
      </div>
      <p className="mt-3 text-sm text-neutral-600">
        {client.phone && (
          <a href={`tel:${client.phone}`} className="mr-4 underline underline-offset-4 hover:text-burgundy">
            {formatPhone(client.phone)}
          </a>
        )}
        <Link href={`/admin/${slug}/poruke`} className="underline underline-offset-4 hover:text-burgundy">
          ← Sve poruke
        </Link>
      </p>
      <div className="mt-10">
        <ChatThread
          messages={messages}
          viewerIsSalon
          send={sendToClient.bind(null, slug, clientId)}
          emptyHint=""
        />
      </div>
    </main>
  );
}
