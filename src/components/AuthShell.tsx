import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card used by login, registration and profile pages. */
export function AuthShell({ eyebrow, title, intro, children, footer }: AuthShellProps) {
  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1} className="page grid min-h-[calc(100dvh-4rem)] items-start gap-10 py-10 sm:py-16 lg:grid-cols-[1fr_28rem] lg:items-center">
        <aside className="hidden lg:block">
          <p className="eyebrow">mojfrizer.com</p>
          <p className="mt-6 max-w-md font-serif text-6xl leading-[1.02] tracking-tight">
            Termin kod frizera, <em className="text-burgundy">bez čekanja</em> na telefonu.
          </p>
          <ul className="mt-10 grid max-w-sm gap-3 text-muted">
            <li className="flex gap-3">
              <span className="text-burgundy">✓</span> Svi vaši termini na jednom mestu
            </li>
            <li className="flex gap-3">
              <span className="text-burgundy">✓</span> Podsetnik na email dan pre termina
            </li>
            <li className="flex gap-3">
              <span className="text-burgundy">✓</span> Poruke direktno salonu
            </li>
          </ul>
        </aside>
        <div className="animate-rise card mx-auto w-full max-w-md p-6 sm:p-8">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl leading-none sm:text-5xl">{title}</h1>
          {intro && <div className="mt-3 text-sm text-muted">{intro}</div>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-5 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </>
  );
}
