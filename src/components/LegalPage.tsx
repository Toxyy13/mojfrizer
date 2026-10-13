import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LINKS, LEGAL_UPDATED } from "@/lib/company";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

interface LegalPageProps {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}

/** Long-form text page (terms, privacy, cookies…) with readable typography and links to the other legal pages. */
export function LegalPage({ eyebrow, title, intro, children }: LegalPageProps) {
  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1} className="page grid gap-10 py-10 outline-none sm:py-16 lg:grid-cols-[1fr_16rem]">
        <article className="min-w-0 max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl leading-none font-bold sm:text-6xl">{title}</h1>
          <p className="mt-4 text-sm text-muted">Poslednja izmena: {LEGAL_UPDATED}</p>
          {intro && <div className="mt-6 text-lg text-muted">{intro}</div>}
          <div className="mt-10 grid gap-4 leading-relaxed [&_a]:link [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:min-w-28 [&_table]:text-left [&_table]:text-sm [&_td]:border-b [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:border-b [&_th]:border-charcoal [&_th]:py-2 [&_th]:pr-3 [&_ul]:grid [&_ul]:gap-1.5">
            {children}
          </div>
        </article>
        <nav aria-label="Pravne informacije" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Pravne informacije</p>
          <ul className="mt-3 grid gap-1 text-sm">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-2 text-muted hover:bg-sand hover:text-charcoal">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}

/** Business detail that may still be a placeholder; placeholders are highlighted so they are not missed. */
export function Detail({ value }: { value: string }) {
  return value.startsWith("[") ? <mark className="rounded bg-burgundy-soft px-1 text-burgundy">{value}</mark> : <>{value}</>;
}
