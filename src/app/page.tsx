import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const salons = await db.salon.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { name: true, slug: true, city: true },
    take: 50,
  });

  return (
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
          placeholder="Naziv salona ili grad"
          className="w-full bg-transparent py-2 text-2xl outline-none placeholder:text-neutral-400"
        />
        <button className="text-sm uppercase tracking-[0.2em] transition-colors hover:text-burgundy">Traži</button>
      </form>
      <section className="mt-12 border-t border-neutral-200" aria-label="Saloni">
        {salons.length === 0 && <p className="py-6 text-neutral-500">Nema salona za „{q}”.</p>}
        {salons.map((s) => (
          <Link
            key={s.slug}
            href={`/s/${s.slug}`}
            className="flex items-baseline justify-between border-b border-neutral-200 py-6 transition-all duration-300 ease-out hover:pl-2 hover:text-burgundy"
          >
            <span className="font-serif text-3xl">{s.name}</span>
            <span className="text-sm text-neutral-500">{s.city}</span>
          </Link>
        ))}
      </section>
      <footer className="mt-16 text-sm text-neutral-500">
        <Link href="/prijava" className="underline underline-offset-4 hover:text-burgundy">
          Prijava
        </Link>
      </footer>
    </main>
  );
}
