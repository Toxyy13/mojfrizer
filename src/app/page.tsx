import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AssistantWidget } from "@/components/AssistantWidget";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fullAddress } from "@/lib/salonAddress";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Pronađite salon", text: "Po nazivu, gradu ili ulici." },
  { title: "Izaberite uslugu i vreme", text: "Vidite samo termine koji su zaista slobodni." },
  { title: "Dođite na vreme", text: "Sa nalogom vam podsetnik stiže na email dan pre termina." },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export default async function HomePage({ searchParams }: HomeProps) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const user = await getSessionUser();

  const [salons, me] = await Promise.all([
    db.salon.findMany({
      where: {
        isActive: true,
        // A newly opened salon shows up in search once it has a price list.
        services: { some: { isActive: true } },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                { address: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, city: true, address: true },
      take: 50,
    }),
    user ? db.user.findUnique({ where: { id: user.id }, select: { favoriteSalonId: true } }) : null,
  ]);

  const returnTo = q ? `/?q=${encodeURIComponent(q)}` : "/";
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page pt-14 pb-12 sm:pt-24 sm:pb-20">
          <div className="animate-rise max-w-3xl">
            <p className="eyebrow">Frizerski saloni širom Srbije</p>
            <h1 className="mt-5 font-serif text-[44px] leading-[1.02] tracking-tight sm:text-7xl md:text-8xl">
              Vaš frizer, <em className="text-burgundy">jedan klik</em> dalje.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Pronađite salon, izaberite slobodan termin i zakažite za par sekundi. Bez poziva, u bilo koje doba dana.
            </p>
          </div>

          <form
            role="search"
            action="/#saloni"
            className="mt-10 flex max-w-2xl items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-5 transition-colors focus-within:border-burgundy focus-within:ring-4 focus-within:ring-burgundy/10"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <label htmlFor="q" className="sr-only">
              Pretraga salona
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Naziv salona, grad ili ulica"
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-neutral-400"
            />
            <button className="btn-primary shrink-0">Traži</button>
          </form>
        </section>

        <section id="saloni" className="page scroll-mt-20" aria-labelledby="saloni-naslov">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
            <h2 id="saloni-naslov" className="font-serif text-3xl sm:text-4xl">
              {q ? `Rezultati za „${q}”` : "Saloni"}
            </h2>
            <span className="text-sm text-muted">
              {salons.length} {salons.length === 1 ? "salon" : "salona"}
              {q && (
                <>
                  {" · "}
                  <Link href="/#saloni" className="link">
                    Prikaži sve
                  </Link>
                </>
              )}
            </span>
          </div>

          {salons.length === 0 && (
            <div className="card mt-6 p-8 text-center">
              <p className="font-serif text-2xl">Nema salona za „{q}”.</p>
              <p className="mt-2 text-sm text-muted">Probajte samo naziv grada, na primer „Niš”.</p>
            </div>
          )}

          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {salons.map((s, i) => (
              <li
                key={s.id}
                className={`card group relative flex items-center gap-4 p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-charcoal/40 sm:p-5 ${
                  i === 0 && salons.length > 1 ? "md:col-span-2" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="grid size-14 shrink-0 place-items-center rounded-xl bg-burgundy-soft font-serif text-xl text-burgundy"
                >
                  {initials(s.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/s/${s.slug}`} className="block font-serif text-2xl leading-tight after:absolute after:inset-0">
                    {s.name}
                  </Link>
                  <p className="mt-1 truncate text-sm text-muted">{fullAddress(s)}</p>
                </div>
                <div className="relative z-10 flex shrink-0 items-center gap-2">
                  {me && (
                    <span className="hidden sm:block">
                      <FavoriteButton salonId={s.id} isFavorite={me.favoriteSalonId === s.id} returnTo={returnTo} />
                    </span>
                  )}
                  <Link href={`/s/${s.slug}#zakazivanje`} className="btn-primary btn-sm">
                    Zakaži
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="page mt-24 grid gap-10 md:grid-cols-[1fr_1.4fr]" aria-labelledby="kako-naslov">
          <div>
            <p className="eyebrow">Kako radi</p>
            <h2 id="kako-naslov" className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
              Tri koraka do <em>novog izgleda</em>.
            </h2>
          </div>
          <ol className="border-t border-line">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-6 border-b border-line py-6">
                <span className="w-12 shrink-0 font-serif text-3xl text-burgundy">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-lg font-medium">{step.title}</p>
                  <p className="mt-1 text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {!user && (
          <section className="page mt-24">
            <div className="flex flex-col gap-6 rounded-3xl bg-charcoal p-8 text-white sm:p-12 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <h2 className="font-serif text-3xl sm:text-4xl">Omiljeni salon uvek pri ruci.</h2>
                <p className="mt-3 text-white/70">
                  Sa nalogom vidite svoje termine, pišete salonu i posle prijave idete pravo na svoj salon.
                </p>
              </div>
              <Link href="/registracija" className="btn shrink-0 bg-white text-charcoal hover:-translate-y-0.5 hover:bg-cream">
                Napravi besplatan nalog
              </Link>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <AssistantWidget />
    </>
  );
}
