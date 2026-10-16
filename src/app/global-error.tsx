"use client";

import "./globals.css";

/** Last resort: replaces the whole page (including the layout) when even the layout fails. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="sr-Latn">
      <body className="min-h-dvh bg-cream font-sans text-charcoal antialiased">
        <main className="page grid min-h-dvh place-content-center py-16 text-center">
          <p className="eyebrow">Greška 500</p>
          <h1 className="mt-4 font-serif text-5xl leading-none tracking-tight sm:text-7xl">Nešto nije u redu</h1>
          <p className="mx-auto mt-5 max-w-md text-muted">Sajt trenutno ne radi kako treba. Pokušajte ponovo za nekoliko trenutaka.</p>
          {error.digest && <p className="mt-3 text-xs text-muted">Šifra greške: {error.digest}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="btn-primary">
              Pokušaj ponovo
            </button>
            <a href="/" className="btn-secondary">
              Na početnu
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
