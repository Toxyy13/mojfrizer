import Link from "next/link";
import { notFound } from "next/navigation";
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
  const client = await db.user.findUnique({ where: { id: clientId }, select: { name: true, phone: true } });
  if (!client) notFound();
  await markRead(salon.id, clientId, true);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{salon.name}</p>
      <h1 className="mt-4 font-serif text-5xl leading-none">{client.name}</h1>
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
