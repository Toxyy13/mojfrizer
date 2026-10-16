import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroSpotlight } from "@/components/HeroSpotlight";
import { Marquee } from "@/components/Marquee";
import { AvatarPrompt } from "@/components/AvatarPrompt";
import { shouldShowAvatarPrompt } from "@/lib/avatarPrompt";
import { SiteHeader } from "@/components/SiteHeader";
import { AssistantWidget } from "@/components/AssistantWidget";
import { PUBLIC_SALONS, canViewSalon } from "@/lib/salonVisibility";
import { getSessionUser } from "@/lib/auth";
import { matchesQuery } from "@/lib/searchText";
import { db } from "@/lib/db";
import { fullAddress } from "@/lib/salonAddress";
import { formatRating, getSalonRatings } from "@/lib/reviews";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Pronađite salon", text: "Po nazivu, gradu ili ulici." },
  { title: "Izaberite uslugu i vreme", text: "Vidite samo termine koji su zaista slobodni." },
  { title: "Dođite na vreme", text: "Sa nalogom vam podsetnik stiže na email dan pre termina." },
];

const TICKER = ["Zakazivanje u par klikova", "Bez poziva", "Podsetnik na email", "Radi na telefonu", "Besplatno za mušterije", "Lista čekanja za pune dane"];

/** Splits a word into letters, each animating in with a stagger and reacting to hover. */
function WordmarkLine({ text, start, accentLast = false }: { text: string; start: number; accentLast?: boolean }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span
          key={i}
          className={`wordmark-letter animate-letter ${accentLast && i === text.length - 1 ? "text-burgundy" : ""}`}
          style={{ animationDelay: `${(start + i) * 70}ms` }}
        >
          <span aria-hidden className="invisible">{ch}</span>
          <span aria-hidden className="wordmark-glyph">{ch}</span>
        </span>
      ))}
    </>
  );
}

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

  const [allSalons, me] = await Promise.all([
    db.salon.findMany({
      where: {
        isActive: true,
        // Private salons never show up in search or lists.
        ...PUBLIC_SALONS,
        // A newly opened salon shows up in search once it has a price list.
        services: { some: { isActive: true } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, city: true, address: true },
      // Diacritics and script don't matter in the search, so it is matched in code (see searchText.ts).
      ...(q ? {} : { take: 50 }),
    }),
    user
      ? db.user.findUnique({
          where: { id: user.id },
          select: { avatar: { select: { userId: true } }, favoriteSalonId: true, favoriteSalon: { select: { id: true, name: true, slug: true, city: true, address: true, isActive: true } } },
        })
      : null,
  ]);
  const salons = (q ? allSalons.filter((s) => matchesQuery(q, s.name, s.city, s.address)) : allSalons).slice(0, 50);
  // The favorite is shown even when the salon is private, as long as this customer may open it.
  const favorite = me?.favoriteSalon?.isActive && (await canViewSalon(me.favoriteSalon.id, user)) ? me.favoriteSalon : null;
  const ratings = await getSalonRatings(salons.map((s) => s.id));

  const showAvatarPrompt = user ? await shouldShowAvatarPrompt(user.role, !!me?.avatar) : false;
  const returnTo = q ? `/?q=${encodeURIComponent(q)}` : "/";
  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1}>
        {showAvatarPrompt && <AvatarPrompt className="page mt-4" />}
        <HeroSpotlight className="relative isolate overflow-hidden">
          {/* Soft moving color fields behind the wordmark. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="animate-float absolute -top-24 -left-24 size-[28rem] rounded-full bg-burgundy/20 blur-3xl sm:size-[40rem]" />
            <div className="animate-float-slow absolute top-1/3 -right-32 size-[24rem] rounded-full bg-[#e9b7a6]/50 blur-3xl sm:size-[34rem]" />
          </div>

          <div className="page pt-10 pb-14 sm:pt-16 sm:pb-24">
            <p className="eyebrow animate-fade-up">Online zakazivanje kod frizera</p>

            <h1 className="parallax-slow mt-4 select-none font-serif font-extrabold uppercase leading-[0.82] tracking-[-0.05em] text-charcoal" aria-label="Moj frizer">
              <span aria-hidden className="block whitespace-nowrap text-[min(27vw,23rem)]">
                <WordmarkLine text="Moj" start={0} />
              </span>
              <span aria-hidden className="block whitespace-nowrap text-[min(27vw,23rem)]">
                <WordmarkLine text="Frizer" start={3} accentLast />
              </span>
            </h1>

            <div className="mt-10 grid items-end gap-8 md:grid-cols-[1.1fr_1fr]">
              <p className="animate-fade-up text-xl text-muted [animation-delay:0.9s] sm:text-2xl">
                Pronađite salon, izaberite slobodan termin i zakažite u par klikova.{" "}
                <span className="text-charcoal">Bez poziva, u bilo koje doba dana.</span>
              </p>
              <form
                role="search"
                action="/#saloni"
                className="animate-fade-up flex items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-5 shadow-[0_20px_60px_-24px_rgb(107_29_47/0.45)] transition-all [animation-delay:1.1s] focus-within:border-burgundy focus-within:ring-4 focus-within:ring-burgundy/10"
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
                  className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted"
                />
                <button className="btn-primary btn-shine shrink-0">Traži</button>
              </form>
            </div>
          </div>
        </HeroSpotlight>

        <Marquee items={TICKER} />

        <section id="saloni" className="page scroll-mt-20 pt-16" aria-labelledby="saloni-naslov">
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

          {favorite && !q && (
            <div className="card mt-6 flex items-center gap-4 border-burgundy/30 p-4 sm:p-5">
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl bg-burgundy text-white font-serif text-xl">
                {initials(favorite.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Vaš omiljeni salon</p>
                <Link href={`/s/${favorite.slug}`} className="block font-serif text-2xl leading-tight">
                  {favorite.name}
                </Link>
                <p className="mt-1 truncate text-sm text-muted">{fullAddress(favorite)}</p>
              </div>
              <Link href={`/s/${favorite.slug}#zakazivanje`} className="btn-primary btn-sm">
                Zakaži
              </Link>
            </div>
          )}

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
                className={`card reveal group relative flex items-center gap-4 p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-burgundy/40 hover:shadow-[0_24px_50px_-28px_rgb(107_29_47/0.5)] sm:p-5 ${
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
                  <p className="mt-1 truncate text-sm text-muted">
                    {ratings.has(s.id) && (
                      <span className="mr-2 text-burgundy">★ {formatRating(ratings.get(s.id)?.average ?? 0)}</span>
                    )}
                    {fullAddress(s)}
                  </p>
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

        <section className="page reveal mt-28 grid gap-10 md:grid-cols-[1fr_1.4fr]" aria-labelledby="kako-naslov">
          <div>
            <p className="eyebrow">Kako radi</p>
            <h2 id="kako-naslov" className="mt-4 font-serif text-5xl font-bold leading-[0.95] sm:text-7xl">
              Tri koraka do <em>novog izgleda</em>.
            </h2>
          </div>
          <ol className="border-t border-line">
            {STEPS.map((step, i) => (
              <li key={step.title} className="reveal flex gap-6 border-b border-line py-7">
                <span className="w-16 shrink-0 font-serif text-5xl font-bold text-burgundy/80">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-lg font-medium">{step.title}</p>
                  <p className="mt-1 text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="page mt-28">
          <div className="flex flex-col gap-4 border-y border-line py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Za salone</p>
              <p className="mt-2 font-serif text-2xl sm:text-3xl">Imate frizerski salon?</p>
            </div>
            <Link href="/dodaj-salon" className="btn-secondary shrink-0">Dodaj svoj salon</Link>
          </div>
        </section>

        {!user && (
          <section className="page reveal-scale mt-16">
            <div className="flex flex-col gap-6 rounded-[2rem] bg-charcoal p-8 text-white sm:p-12 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <h2 className="font-serif text-4xl font-bold leading-none sm:text-6xl">Omiljeni salon uvek pri ruci.</h2>
                <p className="mt-3 text-white/70">
                  Sa nalogom vidite svoje termine, pišete salonu i posle prijave idete pravo na svoj salon.
                </p>
              </div>
              <Link href="/registracija" className="btn btn-shine shrink-0 bg-white text-charcoal hover:-translate-y-0.5 hover:bg-cream">
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
