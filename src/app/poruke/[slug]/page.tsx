import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatThread } from "@/components/ChatThread";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { loadConversation, markRead } from "@/lib/chat";
import { db } from "@/lib/db";
import { sendToSalon } from "../actions";

export const metadata: Metadata = { title: "Poruke · mojfrizer" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomerChatPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(`/poruke/${slug}`)}`);
  // Salon staff answer from the admin panel.
  if (user.role !== "CLIENT") redirect("/admin");

  const salon = await db.salon.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true } });
  if (!salon) notFound();

  await markRead(salon.id, user.id, false);
  const messages = await loadConversation(salon.id, user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Poruke</p>
        <h1 className="mt-4 font-serif text-5xl leading-none">{salon.name}</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Pitajte salon za termin ili cenu. Odgovor stiže ovde.{" "}
          <Link href={`/s/${salon.slug}`} className="underline underline-offset-4 hover:text-burgundy">
            Nazad na salon
          </Link>
        </p>
        <div className="mt-10">
          <ChatThread
            messages={messages}
            viewerIsSalon={false}
            send={sendToSalon.bind(null, slug)}
            emptyHint="Još nema poruka. Napišite prvu."
          />
        </div>
      </main>
    </>
  );
}
