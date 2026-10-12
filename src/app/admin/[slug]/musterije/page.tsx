import Link from "next/link";
import { requireSalonAccess } from "@/lib/access";
import { displayPhone, listSalonClients, shortDate } from "@/lib/clients";
import { formatRsd } from "@/lib/money";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function ClientsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { salon } = await requireSalonAccess(slug);
  const q = ((await searchParams).q ?? "").slice(0, 60);
  const clients = await listSalonClients(salon.id, q);

  return (
    <main className="page pb-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line py-8">
        <div>
          <p className="eyebrow">Mušterije</p>
          <h1 className="font-serif text-5xl">{salon.name}</h1>
        </div>
        <Link href={`/admin/${salon.slug}`} className="link text-sm">
          ← Raspored
        </Link>
      </header>

      <form className="mt-8 flex gap-3" role="search">
        <input name="q" defaultValue={q} placeholder="Ime ili telefon" className="field mt-0 max-w-md" aria-label="Pretraga mušterija" />
        <button className="btn-secondary">Traži</button>
      </form>

      <p className="mt-4 text-sm text-muted">
        Ukupno: {clients.length}
        {q ? ` za „${q}"` : ""}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="py-3 pr-4 font-medium">Ime</th>
              <th className="py-3 pr-4 font-medium">Telefon</th>
              <th className="py-3 pr-4 text-right font-medium">Dolazaka</th>
              <th className="py-3 pr-4 text-right font-medium">Potrošio/la</th>
              <th className="py-3 pr-4 font-medium">Poslednji put</th>
              <th className="py-3 pr-4 font-medium">Sledeći termin</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.key} className="border-b border-line">
                <td className="py-3 pr-4">
                  <Link href={`/admin/${salon.slug}/musterije/${encodeURIComponent(c.key)}`} className="link font-medium">
                    {c.name}
                  </Link>
                  {c.noShows > 0 && (
                    <span className="badge ml-2 bg-burgundy-soft text-burgundy">{c.noShows}× nije došao/la</span>
                  )}
                  {c.blockedOnline && <span className="badge ml-2 bg-sand">samo telefonom</span>}
                  {c.note && <span className="mt-0.5 block truncate text-xs text-muted">{c.note}</span>}
                </td>
                <td className="py-3 pr-4 font-mono">{displayPhone(c.phone)}</td>
                <td className="py-3 pr-4 text-right font-mono">{c.visits}</td>
                <td className="py-3 pr-4 text-right font-mono">{formatRsd(c.spentPara)}</td>
                <td className="py-3 pr-4">{shortDate(c.lastVisit)}</td>
                <td className="py-3 pr-4">{shortDate(c.nextVisit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <p className="py-8 text-muted">Nema mušterija{q ? " za ovu pretragu" : " još"}.</p>}
      </div>
    </main>
  );
}
