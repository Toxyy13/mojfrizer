import Link from "next/link";
import { redirect } from "next/navigation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroSpotlight } from "@/components/HeroSpotlight";
import { Marquee } from "@/components/Marquee";
import { ScissorsLine } from "@/components/ScissorsLine";
import { AvatarPrompt } from "@/components/AvatarPrompt";
import { shouldShowAvatarPrompt } from "@/lib/avatarPrompt";
import { SiteHeader } from "@/components/SiteHeader";
import { AssistantWidget } from "@/components/AssistantWidget";
import { PUBLIC_SALONS, canViewSalon, isSalonRole } from "@/lib/salonVisibility";
import { getSessionUser } from "@/lib/auth";
import { AudienceBadges } from "@/components/AudienceBadges";
import { AudiencePicker } from "@/components/AudiencePicker";
import { parseAudiences } from "@/lib/audience";
import { matchesQuery } from "@/lib/searchText";
import { db } from "@/lib/db";
import { fullAddress } from "@/lib/salonAddress";
import { formatRating, getSalonRatings } from "@/lib/reviews";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ q?: string; v?: string | string[] }>;
}

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Pronađite salon", text: "Po nazivu, gradu ili ulici." },
  { title: "Izaberite uslugu i vreme", text: "Vidite samo termine koji su zaista slobodni." },
  { title: "Dođite na vreme", text: "Sa nalogom vam podsetnik stiže na email dan pre termina." },
];

const TICKER = ["Zakazivanje u par klikova", "Bez poziva", "Podsetnik na email", "Radi na telefonu", "Besplatno za mušterije", "Lista čekanja za pune dane"];

/** Splits a word into letters, each animating in with a stagger and reacting to hover. */
function WordmarkLine({ text, start, }: { text: string; start: number; accentLast?: boolean }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="wordmark-letter animate-letter"
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
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 60);
  // Ticked types narrow the list: a salon must work with every ticked one. Nothing ticked shows all salons.
  const wanted = parseAudiences([params.v ?? []].flat());
  const user = await getSessionUser();
  if (isSalonRole(user?.role)) redirect("/admin");

  const [allSalons, me] = await Promise.all([
    db.salon.findMany({
      where: {
        isActive: true,
        audiences: { hasEvery: wanted },
        // Private salons never show up in search or lists.
        ...PUBLIC_SALONS,
        // A newly opened salon shows up in search once it has a price list.
        services: { some: { isActive: true } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, city: true, address: true, audiences: true },
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
  const filtered = q || wanted.length > 0;
  const returnTo = "/" + (filtered ? `?${new URLSearchParams([["q", q], ...wanted.map((v) => ["v", v])])}` : "");
  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1}>
        {showAvatarPrompt && <AvatarPrompt className="page mt-4" />}
        <div aria-hidden className="awning" />
        <HeroSpotlight className="relative isolate">
          <div className="page pt-8 pb-16 sm:pt-12 sm:pb-24">
            <p className="eyebrow animate-fade-up">Online zakazivanje kod frizera</p>

            <div className="mt-4 flex items-stretch gap-3 sm:gap-6">
              
              <h1
                className="parallax-slow sign-text min-w-0 flex-1 rounded-3xl bg-charcoal px-4 py-5 leading-[0.9] shadow-[0_30px_60px_-30px_rgb(17_24_39/0.7)] select-none sm:px-8 sm:py-8"
                aria-label="Moj frizer"
              >
                <span aria-hidden className="block whitespace-nowrap text-[min(13.5vw,10.5rem)]">
                  <WordmarkLine text="Moj" start={0} />
                </span>
                <span aria-hidden className="block whitespace-nowrap text-[min(13.5vw,10.5rem)]">
                  <WordmarkLine text="Frizer" start={3} />
                </span>
              </h1>
              <div aria-hidden className="pole w-5 shrink-0 sm:w-10" />
            </div>

            <div className="mt-10 grid items-end gap-8 md:grid-cols-[1.1fr_1fr]">
              <p className="animate-fade-up text-lg text-muted [animation-delay:0.9s] sm:text-xl">
                Pronađite salon, izaberite slobodan termin i zakažite u par klikova.{" "}
                <span className="font-semibold text-charcoal">Bez poziva, u bilo koje doba dana.</span>
              </p>
              <form role="search" action="/#saloni" className="animate-fade-up [animation-delay:1.1s]">
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper p-1.5 pl-4 shadow-[0_12px_32px_-16px_rgb(17_24_39/0.35)] transition-shadow focus-within:border-burgundy focus-within:ring-4 focus-within:ring-burgundy/12">
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
                <button className="btn-primary shrink-0">Traži</button>
              </div>
              <div className="mt-4">
                <AudiencePicker name="v" selected={wanted} legend="Vrsta frizera" />
              </div>
              </form>
            </div>
          </div>
        </HeroSpotlight>

        <Marquee items={TICKER} />

        <section id="saloni" className="page scroll-mt-20 pt-20" aria-labelledby="saloni-naslov">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
            <h2 id="saloni-naslov" className="font-serif text-4xl font-bold sm:text-6xl">
              {q ? `Rezultati za „${q}”` : wanted.length > 0 ? "Rezultati" : "Saloni"}
            </h2>
            <span className="pb-1 text-sm text-muted">
              {salons.length} {salons.length === 1 ? "salon" : "salona"}
              {filtered && (
                <>
                  {" · "}
                  <Link href="/#saloni" className="link">
                    Prikaži sve
                  </Link>
                </>
              )}
            </span>
          </div>

          {favorite && !filtered && (
            <div className="ticket mt-8 bg-burgundy-soft">
              <div className="ticket-stub">
                <span aria-hidden className="grid size-12 place-items-center rounded-full border border-line bg-burgundy font-serif text-lg text-white">
                  {initials(favorite.name)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-4 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Vaš omiljeni salon</p>
                  <Link href={`/s/${favorite.slug}`} className="block font-serif text-2xl leading-tight font-semibold">
                    {favorite.name}
                  </Link>
                  <p className="mt-1 truncate text-sm text-muted">{fullAddress(favorite)}</p>
                </div>
                <Link href={`/s/${favorite.slug}#zakazivanje`} className="btn-primary btn-sm">
                  Zakaži
                </Link>
              </div>
            </div>
          )}

          {salons.length === 0 && (
            <div className="card-ink mt-8 p-8 text-center">
              <p className="font-serif text-3xl">Nema salona{q ? <> za „{q}”</> : " za izabranu vrstu frizera"}.</p>
              <p className="mt-2 text-sm text-muted">Probajte samo naziv grada ili uklonite neku od izabranih vrsta.</p>
            </div>
          )}

          <ul className="mt-8 grid gap-6 md:grid-cols-2">
            {salons.map((s, i) => (
              <li key={s.id} className={`reveal min-w-0 ${i === 0 && salons.length > 1 ? "md:col-span-2" : ""}`}>
                <div className="ticket group relative">
                  <div className="ticket-stub">
                    <span aria-hidden className="grid size-14 place-items-center rounded-full border border-line bg-paper font-serif text-xl font-semibold text-burgundy transition-transform duration-300 group-hover:rotate-[-12deg] group-hover:scale-110">
                      {initials(s.name)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-4 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/s/${s.slug}`} className="block font-serif text-2xl leading-tight font-semibold after:absolute after:inset-0 after:z-0 after:rounded-xl">
                        {s.name}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted">
                        {ratings.has(s.id) && (
                          <span className="mr-2 font-semibold text-burgundy">★ {formatRating(ratings.get(s.id)?.average ?? 0)}</span>
                        )}
                        {fullAddress(s)}
                      </p>
                      <AudienceBadges audiences={s.audiences} className="mt-2" />
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
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="page mt-28 grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-center" aria-labelledby="kako-naslov">
          <div className="reveal">
            <p className="eyebrow">Kako radi</p>
            <h2 id="kako-naslov" className="mt-3 font-serif text-5xl leading-[0.95] font-bold sm:text-7xl">
              Tri koraka do novog izgleda
            </h2>
            <ScissorsLine />
          </div>
          <ol className="board p-6 sm:p-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="reveal flex gap-5 border-b border-dashed border-cream/20 py-5 last:border-b-0">
                <span className="w-10 shrink-0 font-serif text-4xl leading-none font-bold text-[#f0b64a]">{i + 1}</span>
                <div>
                  <p className="font-serif text-2xl leading-tight">{step.title}</p>
                  <p className="mt-1 text-cream/75">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="page mt-24">
          <div className="card-ink flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="eyebrow">Za salone</p>
              <p className="mt-1 font-serif text-3xl sm:text-4xl">Imate frizerski salon?</p>
            </div>
            <Link href="/dodaj-salon" className="btn-secondary shrink-0">Dodaj svoj salon</Link>
          </div>
        </section>

        {!user && (
          <section className="page reveal-scale mt-16">
            <div className="flex flex-col gap-6 rounded-3xl bg-burgundy p-8 text-white shadow-[0_30px_60px_-30px_rgb(17_24_39/0.7)] sm:p-12 md:flex-row md:items-center md:justify-between">
              <div className="max-w-lg">
                <h2 className="font-serif text-4xl leading-none font-bold sm:text-6xl">Omiljeni salon uvek pri ruci</h2>
                <p className="mt-3 text-white/85">
                  Sa nalogom vidite svoje termine, pišete salonu i posle prijave idete pravo na svoj salon.
                </p>
              </div>
              <Link href="/registracija" className="btn shrink-0 bg-paper text-charcoal hover:bg-cream">
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
