"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/ErrorPanel";

/** Shown when something breaks while a page is being prepared. The details are only logged, never shown. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorPanel
      code="500"
      title="Nešto nije u redu"
      bar
      actions={
        <>
          <button type="button" onClick={reset} className="btn-primary">
            Pokušaj ponovo
          </button>
          <a href="/" className="btn-secondary">
            Na početnu
          </a>
        </>
      }
    >
      <p>Došlo je do greške na našoj strani, a ne zbog vas. Pokušajte ponovo za nekoliko trenutaka.</p>
      {error.digest && <p className="mt-3 text-xs">Šifra greške: {error.digest}</p>}
    </ErrorPanel>
  );
}
