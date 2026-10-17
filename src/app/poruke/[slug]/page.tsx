import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatThread } from "@/components/ChatThread";
import { SiteHeader } from "@/components/SiteHeader";
import { findViewableSalon } from "@/lib/salonVisibility";
import { getSessionUser } from "@/lib/auth";
import { loadConversation, markRead } from "@/lib/chat";
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

  const salon = await findViewableSalon(slug);
  if (!salon) notFound();

  await markRead(salon.id, user.id, false);
  const messages = await loadConversation(salon.id, user.id);

  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1} className="page max-w-2xl py-8 sm:py-12">
        <header className="flex items-center gap-4">
          <Link href={`/s/${salon.slug}`} className="btn-ghost size-11 shrink-0 p-0 text-lg" aria-label="Nazad na salon">
            ←
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">Poruke</p>
            <h1 className="truncate font-serif text-3xl leading-tight sm:text-4xl">{salon.name}</h1>
          </div>
        </header>
        <p className="mt-3 text-sm text-muted">Pitajte salon za termin ili cenu. Odgovor stiže ovde.</p>
        <div className="mt-6">
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
