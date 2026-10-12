import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await getSessionUser();
  if (!user) redirect("/prijava");
  const salons = await db.salon.findMany({
    where: { OR: [{ ownerId: user.id }, { workers: { some: { userId: user.id, isActive: true } } }] },
    select: { name: true, slug: true },
  });
  if (salons.length === 1) redirect(`/admin/${salons[0].slug}`);
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-serif text-5xl">Vaši saloni</h1>
      {salons.length === 0 && <p className="mt-6 text-neutral-600">Nemate pristup nijednom salonu.</p>}
      <ul className="mt-10 border-t border-neutral-200">
        {salons.map((s) => (
          <li key={s.slug}>
            <Link href={`/admin/${s.slug}`} className="block border-b border-neutral-200 py-5 font-serif text-3xl hover:text-burgundy">
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
