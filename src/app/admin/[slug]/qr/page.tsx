import QRCode from "qrcode";
import { AdminShell } from "@/components/AdminShell";
import { requireSalonAccess } from "@/lib/access";
import { fullAddress } from "@/lib/salonAddress";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/** Printable poster for the shop window: QR code to the salon's booking page. */
export default async function SalonQrPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { salon, user } = await requireSalonAccess(slug);
  const url = `${process.env.APP_URL ?? "https://mojfrizer.com"}/s/${salon.slug}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1f1d1b", light: "#ffffff" } });
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const pngDataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "M" });

  return (
    <AdminShell salon={salon} user={user} active="qr">
      <header className="print:hidden">
        <h1 className="font-serif text-3xl sm:text-4xl">QR kod za izlog</h1>
      </header>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        <a href={pngDataUrl} download={`qr-${salon.slug}.png`} className="btn-secondary">
          Preuzmi sliku (PNG)
        </a>
        <a href={svgDataUrl} download={`qr-${salon.slug}.svg`} className="btn-secondary">
          Preuzmi za štampariju (SVG)
        </a>
      </div>
      <p className="mt-3 text-sm text-muted print:hidden">
        Odštampajte i zalepite u izlog ili na pult. Sliku stavite na Instagram, a link u opis profila: {url}
      </p>

      <article className="card mx-auto mt-10 grid max-w-md justify-items-center gap-6 p-10 text-center print:mt-0 print:border-0">
        <p className="eyebrow">Zakažite online, 0–24h</p>
        <h2 className="font-serif text-4xl leading-tight">{salon.name}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing to optimize */}
        <img src={svgDataUrl} alt={`QR kod za ${url}`} className="aspect-square w-64" />
        <p className="text-sm">
          Skenirajte kamerom telefona
          <span className="mt-1 block font-mono text-xs text-muted">{url.replace(/^https?:\/\//, "")}</span>
        </p>
        <p className="text-xs text-muted">{fullAddress(salon)}</p>
      </article>
    </AdminShell>
  );
}
