import { CLIENT_STATUS_LABEL } from "@/components/clientStatusLabel";
import type { exportAccountData } from "@/lib/accountDeletion";
import { formatRsd } from "@/lib/money";
import { textPdf } from "@/lib/pdf";

type AccountData = NonNullable<Awaited<ReturnType<typeof exportAccountData>>>;

const TZ = "Europe/Belgrade";
const dateTime = (d: Date): string => new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(d);
const day = (d: Date): string => new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "medium", timeZone: TZ }).format(d);

/** The signed-in person's own data as a readable PDF (right of access). */
export function accountExportPdf(data: AccountData): Promise<Uint8Array> {
  const d = data as unknown as {
    name: string; email: string | null; phone: string | null; createdAt: Date; emailVerifiedAt: Date | null;
    favoriteSalon: { name: string } | null;
    clientAppointments: { startTime: Date; status: keyof typeof CLIENT_STATUS_LABEL; price: number; note: string | null; salon: { name: string } }[];
    reviews: { rating: number; comment: string | null; createdAt: Date; salon: { name: string } }[];
    waitlistEntries: { date: Date; salon: { name: string } }[];
    chatAsClient: { text: string; fromSalon: boolean; createdAt: Date; salon: { name: string } }[];
  };
  return textPdf("Moji podaci", `mojfrizer.com · napravljeno ${dateTime(new Date())}`, [
    {
      heading: "Nalog",
      lines: [
        `Ime: ${d.name}`,
        `Mejl: ${d.email ?? "-"}${d.emailVerifiedAt ? " (potvrđen)" : ""}`,
        `Telefon: ${d.phone ?? "-"}`,
        `Nalog napravljen: ${day(d.createdAt)}`,
        `Omiljeni salon: ${d.favoriteSalon?.name ?? "-"}`,
      ],
    },
    {
      heading: "Termini",
      lines: d.clientAppointments.map((a) => `${dateTime(a.startTime)} · ${a.salon.name} · ${CLIENT_STATUS_LABEL[a.status] ?? a.status} · ${formatRsd(a.price)}${a.note ? ` · ${a.note}` : ""}`),
    },
    { heading: "Ocene", lines: d.reviews.map((r) => `${day(r.createdAt)} · ${r.salon.name} · ${r.rating}/5${r.comment ? ` · ${r.comment}` : ""}`) },
    { heading: "Lista čekanja", lines: d.waitlistEntries.map((w) => `${day(w.date)} · ${w.salon.name}`) },
    { heading: "Poruke", lines: d.chatAsClient.map((m) => `${dateTime(m.createdAt)} · ${m.salon.name} · ${m.fromSalon ? "salon" : "vi"}: ${m.text}`) },
  ]);
}
