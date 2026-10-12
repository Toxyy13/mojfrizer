import type { Metadata } from "next";
import Link from "next/link";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fullAddress } from "@/lib/salonAddress";

export const metadata: Metadata = { title: "Pretraga salona · mojfrizer" };
export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const user = await getSessionUser();

  const [salons, me] = await Promise.all([
    db.salon.findMany({
      where: {
        isActive: true,
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { address: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
      orderBy: { name: "asc" },
      take: MAX_RESULTS,
      select: { id: true, name: true, slug: true, city: true, address: true },
    }),
    user ? db.user.findUnique({ where: { id: user.id }, select: { favoriteSalonId: true } }) : null,
  ]);

  const returnTo = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Saloni</p>
        <h1 className="mt-6 font-serif text-6xl leading-none md:text-8xl">Pronađite svoj salon.</h1>

        <form role="search" className="mt-16 flex items-end gap-4 border-b border-neutral-300 focus-within:border-burgundy">
          <label className="flex-1">
            <span className="sr-only">Naziv salona, grad ili ulica</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Naziv salona, grad ili ulica"
              className="w-full bg-transparent py-3 text-xl outline-none"
            />
          </label>
          <button className="pb-3 text-sm uppercase tracking-[0.2em] text-burgundy transition-colors hover:text-burgundy-dark">
            Traži
          </button>
        </form>

        <section className="mt-16 border-t border-neutral-200" aria-live="polite">
          {salons.length === 0 && (
            <p className="py-12 text-neutral-500">Nema salona za „{q}”. Probajte drugi naziv ili grad.</p>
          )}
          {salons.map((salon) => (
            <article
              key={salon.id}
              className="flex flex-col gap-4 border-b border-neutral-200 py-6 md:flex-row md:items-center md:justify-between"
            >
              <Link href={`/s/${salon.slug}`} className="group">
                <span className="block font-serif text-3xl transition-colors duration-300 group-hover:text-burgundy">
                  {salon.name}
                </span>
                <span className="mt-1 block text-sm text-neutral-500">
                  {fullAddress(salon)}
                </span>
              </Link>
              {me && (
                <FavoriteButton salonId={salon.id} isFavorite={me.favoriteSalonId === salon.id} returnTo={returnTo} />
              )}
            </article>
          ))}
        </section>

        {!user && (
          <p className="mt-12 text-sm text-neutral-600">
            <Link href="/login?next=/search" className="text-burgundy underline underline-offset-4">
              Prijavite se
            </Link>{" "}
            da označite omiljeni salon. Posle prijave vodimo vas pravo na njega.
          </p>
        )}
      </main>
    </>
  );
}
