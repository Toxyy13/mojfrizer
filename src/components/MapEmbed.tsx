"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent } from "@/lib/consent";

interface MapEmbedProps {
  address: string;
  src: string;
}

/** Google Maps iframe, loaded only after the visitor allows it (it sets Google cookies). */
export function MapEmbed({ address, src }: MapEmbedProps) {
  const [allowed, setAllowed] = useState(false);
  const [once, setOnce] = useState(false);

  useEffect(() => {
    const sync = (): void => setAllowed(readConsent() === "all");
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (allowed || once) {
    return <iframe title={`Mapa: ${address}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full border-0 sm:h-64" />;
  }
  return (
    <div className="grid h-56 place-items-center bg-sand p-6 text-center sm:h-64">
      <div>
        <p className="text-sm text-muted">Mapa se učitava sa Googlea, koji može postaviti svoje kolačiće.</p>
        <button type="button" onClick={() => setOnce(true)} className="btn-secondary btn-sm mt-3">
          Prikaži mapu
        </button>
      </div>
    </div>
  );
}
