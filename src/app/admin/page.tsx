import Link from "next/link";
import { Logo } from "@/components/Logo";
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
    <main id="sadrzaj" tabIndex={-1} className="page max-w-xl py-16">
      <Logo />
      <h1 className="mt-10 font-serif text-4xl">Vaši saloni</h1>
      {salons.length === 0 && <p className="mt-4 text-muted">Nemate pristup nijednom salonu.</p>}
      <ul className="mt-6 grid gap-2">
        {salons.map((s) => (
          <li key={s.slug}>
            <Link href={`/admin/${s.slug}`} className="card flex items-center justify-between p-5 font-serif text-2xl transition-colors hover:border-charcoal">
              {s.name}
              <span aria-hidden className="text-muted">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
