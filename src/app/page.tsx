import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteHeader } from "@/components/SiteHeader";
import { AssistantWidget } from "@/components/AssistantWidget";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fullAddress } from "@/lib/salonAddress";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const user = await getSessionUser();

  const [salons, me] = await Promise.all([
    db.salon.findMany({
      where: {
        isActive: true,
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
      <main className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">mojfrizer.com</p>
        <h1 className="mt-6 font-serif text-6xl leading-none md:text-8xl">Zakažite frizera online.</h1>
        <form role="search" className="mt-16 flex gap-4 border-b border-charcoal pb-2">
          <label htmlFor="q" className="sr-only">
            Pretraga salona
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Naziv salona, grad ili ulica"
            className="w-full bg-transparent py-2 text-2xl outline-none placeholder:text-neutral-400"
          />
          <button className="text-sm uppercase tracking-[0.2em] transition-colors hover:text-burgundy">Traži</button>
        </form>
        <section className="mt-12 border-t border-neutral-200" aria-label="Saloni">
          {salons.length === 0 && <p className="py-6 text-neutral-500">Nema salona za „{q}”.</p>}
          {salons.map((s) => (
            <article
              key={s.id}
              className="flex flex-col gap-4 border-b border-neutral-200 py-6 md:flex-row md:items-center md:justify-between"
            >
              <Link href={`/s/${s.slug}`} className="group">
                <span className="block font-serif text-3xl transition-colors duration-300 group-hover:text-burgundy">
                  {s.name}
                </span>
                <span className="mt-1 block text-sm text-neutral-500">{fullAddress(s)}</span>
              </Link>
              {me && <FavoriteButton salonId={s.id} isFavorite={me.favoriteSalonId === s.id} returnTo={returnTo} />}
            </article>
          ))}
        </section>
        {!user && (
          <p className="mt-12 text-sm text-neutral-600">
            <Link href="/registracija" className="text-burgundy underline underline-offset-4">
              Napravite nalog
            </Link>{" "}
            i označite omiljeni salon. Posle prijave vodimo vas pravo na njega.
          </p>
        )}
      </main>
      <AssistantWidget />
    </>
  );
}
