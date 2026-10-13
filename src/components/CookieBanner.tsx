"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/** Asks once whether embedded Google Maps may load. Both answers are equally easy; nothing is preselected. */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = (): void => setVisible(readConsent() === null);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!visible) return null;
  const choose = (choice: ConsentChoice): void => saveConsent(choice);
  return (
    <section
      role="region"
      aria-label="Kolačići"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)]"
    >
      <p className="font-medium">Kolačići i mapa</p>
      <p className="mt-1 text-sm text-muted">
        Za prijavu koristimo samo neophodne kolačiće. Ako dozvolite, prikazujemo i Google mapu salona, a Google tada može da
        postavi svoje kolačiće. Ne koristimo reklame ni analitiku.{" "}
        <Link href="/kolacici" className="link">
          Detalji
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("essential")} className="btn-secondary btn-sm">
          Samo neophodni
        </button>
        <button type="button" onClick={() => choose("all")} className="btn-secondary btn-sm">
          Dozvoli mapu
        </button>
      </div>
    </section>
  );
}
