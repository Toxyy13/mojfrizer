import { AdminShell } from "@/components/AdminShell";
import { requireSalonOwner } from "@/lib/access";
import { appUrl } from "@/lib/appUrl";
import { qrVersion } from "@/lib/qrVersion";
import { fullAddress } from "@/lib/salonAddress";
import { PrintButton } from "./PrintButton";
import { regenerateQrToken } from "./actions";

export const dynamic = "force-dynamic";

/** Printable poster for the shop window: QR code to the salon's booking page. */
export default async function SalonQrPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ nov?: string }> }) {
  const { slug } = await params;
  const renewed = (await searchParams).nov === "1";
  const { salon, user } = await requireSalonOwner(slug);
  // The poster opens /q/{token}: it connects a logged-in customer to the salon and makes it their favorite.
  const url = `${appUrl()}/q/${salon.qrToken}`;
  // Images come from ./slika (generated on request, cached by token version) instead of being inlined in the page.
  const imageBase = `/admin/${salon.slug}/qr/slika?v=${qrVersion(salon.qrToken)}`;
  const svgUrl = `${imageBase}&format=svg`;

  return (
    <AdminShell salon={salon} user={user} active="qr">
      <header className="print:hidden">
        <h1 className="font-serif text-3xl sm:text-4xl">QR kod za izlog</h1>
      </header>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        <a href={`${imageBase}&format=pdf&preuzmi=1`} download className="btn-secondary">
          Preuzmi plakat (PDF)
        </a>
      </div>
      <p className="mt-3 text-sm text-muted print:hidden">
        Odštampajte i zalepite u izlog ili na pult. Mušterija koja skenira kod dolazi na sajt (uz registraciju ako nema nalog), a
        vaš salon joj se automatski upisuje kao omiljeni.
        {salon.visibility === "PRIVATE" && " Salon je privatan, pa samo ovaj kod otvara stranicu salona novim mušterijama."}
      </p>
      {renewed && <p className="card mt-3 p-3 text-sm print:hidden">Napravljen je novi kod. Stari odštampani plakati više ne rade, odštampajte ovaj.</p>}

      <article className="card mx-auto mt-10 grid max-w-md justify-items-center gap-6 p-10 text-center print:mt-0 print:border-0">
        <p className="eyebrow">Zakažite online, 0–24h</p>
        <h2 className="font-serif text-4xl leading-tight">{salon.name}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated image, nothing to optimize */}
        <img src={svgUrl} alt={`QR kod za ${url}`} className="aspect-square w-64" />
        <p className="text-sm">
          Skenirajte kamerom telefona
          <span className="mt-1 block font-mono text-xs text-muted">{appUrl().replace(/^https?:\/\//, "")}</span>
        </p>
        <p className="text-xs text-muted">{fullAddress(salon)}</p>
      </article>

      <form action={regenerateQrToken.bind(null, salon.slug)} className="mt-10 text-center print:hidden">
        <button className="link text-sm text-muted">Napravi novi kod (stari plakati prestaju da rade)</button>
      </form>
    </AdminShell>
  );
}
