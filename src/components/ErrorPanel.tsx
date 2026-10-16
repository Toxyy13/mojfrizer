import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface ErrorPanelProps {
  /** Big number or word: 404, 500… */
  code: string;
  title: string;
  children: ReactNode;
  /** Buttons under the text; defaults to a link to the home page. */
  actions?: ReactNode;
  /** Draw the simple top bar (for pages that cannot use the full site header, e.g. error boundaries). */
  bar?: boolean;
}

/** The one look of every error page: big code, short Serbian explanation, a way out. */
export function ErrorPanel({ code, title, children, actions, bar = false }: ErrorPanelProps) {
  return (
    <>
      {bar && (
        <div className="border-b border-line/70 bg-cream/85">
          <div className="page flex h-16 items-center">
            <Logo />
          </div>
        </div>
      )}
      <main id="sadrzaj" tabIndex={-1} className="page grid min-h-[60dvh] place-content-center py-16 text-center">
        <p className="eyebrow">Greška {code}</p>
        <h1 className="mt-4 font-serif text-5xl leading-none tracking-tight sm:text-7xl">{title}</h1>
        <div className="mx-auto mt-5 max-w-md text-muted">{children}</div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions ?? (
            <Link href="/" className="btn-primary">
              Na početnu
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
