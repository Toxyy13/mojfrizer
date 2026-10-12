import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSalonAccess } from "@/lib/access";
import { appointmentIdsForClient, displayPhone, isValidClientKey, listSalonClients, shortDate } from "@/lib/clients";
import { formatRsd } from "@/lib/money";
import { TIME_ZONE, formatLocalTime } from "@/lib/time";
import { saveClientNote } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; key: string }>;
  searchParams: Promise<{ sacuvano?: string }>;
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Zakazano",
  COMPLETED: "Završeno",
  CANCELLED: "Otkazano",
  NO_SHOW: "Nije došao/la",
};

export default async function ClientPage({ params, searchParams }: PageProps) {
  const { slug, key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const { salon } = await requireSalonAccess(slug);
  if (!isValidClientKey(key)) notFound();
  const [client] = await listSalonClients(salon.id, "", key);
  if (!client) notFound();
  const saved = (await searchParams).sacuvano === "1";

  const history = await db.appointment.findMany({
    where: { salonId: salon.id, id: { in: await appointmentIdsForClient(salon.id, key) } },
    include: { service: { select: { name: true } }, worker: { select: { displayName: true } } },
    orderBy: { startTime: "desc" },
  });

  return (
    <main className="page max-w-4xl pb-24">
      <header className="border-b border-line py-8">
        <Link href={`/admin/${salon.slug}/musterije`} className="link text-sm">
          ← Sve mušterije
        </Link>
        <h1 className="mt-4 font-serif text-5xl">{client.name}</h1>
        <p className="mt-2 font-mono text-sm">
          {client.phone ? (
            <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="link">
              {displayPhone(client.phone)}
            </a>
          ) : (
            "bez telefona"
          )}
          {client.hasAccount && <span className="badge ml-3 bg-forest-soft text-forest">ima nalog</span>}
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4" aria-label="Pregled">
        <Stat label="Dolazaka" value={String(client.visits)} />
        <Stat label="Potrošio/la" value={formatRsd(client.spentPara)} />
        <Stat label="Nije došao/la" value={String(client.noShows)} warn={client.noShows > 0} />
        <Stat label="Mušterija od" value={shortDate(client.firstVisit)} />
      </section>

      <section className="card mt-8 p-6" aria-labelledby="beleska">
        <h2 id="beleska" className="font-serif text-2xl">
          Beleška salona
        </h2>
        <p className="field-hint mt-1">Vidi samo salon, npr. „broj 2 sa strane", alergije, omiljeni frizer.</p>
        {saved && <p className="mt-3 text-sm text-forest" role="status">Sačuvano.</p>}
        <form action={saveClientNote.bind(null, salon.slug)} className="mt-4 grid gap-4">
          <input type="hidden" name="clientKey" value={key} />
          <textarea name="note" defaultValue={client.note ?? ""} rows={3} maxLength={1000} className="field" aria-label="Beleška" />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="blockedOnline" defaultChecked={client.blockedOnline} className="mt-1" />
            <span>
              Samo telefonom: ova mušterija ne može da zakaže preko sajta, mora da pozove salon.
              {client.noShows >= 2 && !client.blockedOnline && (
                <span className="block text-burgundy">Preporuka: {client.noShows} puta nije došla.</span>
              )}
            </span>
          </label>
          <div>
            <button className="btn-primary btn-sm">Sačuvaj</button>
          </div>
        </form>
      </section>

      <section className="mt-12" aria-labelledby="istorija">
        <h2 id="istorija" className="eyebrow">
          Istorija termina
        </h2>
        <ul className="mt-4 border-t border-line">
          {history.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3 text-sm">
              <span className="font-mono">
                {shortDate(a.startTime)} {formatLocalTime(a.startTime, TIME_ZONE)}
              </span>
              <span>{a.service.name}</span>
              <span className="text-muted">{a.worker.displayName}</span>
              {a.note && <span className="text-xs italic text-muted">„{a.note}"</span>}
              <span className="ml-auto font-mono">{formatRsd(a.price)}</span>
              <span className={`w-28 text-right ${a.status === "NO_SHOW" ? "text-burgundy" : "text-muted"}`}>
                {STATUS_LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-white p-5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-mono text-xl ${warn ? "text-burgundy" : ""}`}>{value}</p>
    </div>
  );
}
