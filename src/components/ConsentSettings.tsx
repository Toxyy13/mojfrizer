"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/** Lets the visitor see and change the cookie choice at any time. */
export function ConsentSettings() {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  useEffect(() => {
    const sync = (): void => setChoice(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  return (
    <div className="card grid gap-3 p-5">
      <p className="text-sm" role="status">
        Trenutni izbor:{" "}
        <strong>{choice === "all" ? "mapa je dozvoljena" : choice === "essential" ? "samo neophodni kolačići" : "još niste izabrali"}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => saveConsent("essential")}>
          Samo neophodni
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => saveConsent("all")}>
          Dozvoli mapu
        </button>
      </div>
    </div>
  );
}
