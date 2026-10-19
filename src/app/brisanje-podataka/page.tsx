import type { Metadata } from "next";
import Link from "next/link";
import { Detail, LegalPage } from "@/components/LegalPage";
import { getSessionUser } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { db } from "@/lib/db";
import { DeleteForm } from "./DeleteForm";
import { setEmailOptOut } from "./actions";

export const metadata: Metadata = {
  title: "Moji podaci i brisanje · mojfrizer",
  description: "Preuzmite, ispravite ili obrišite svoje podatke na mojfrizer.com.",
};
export const dynamic = "force-dynamic";

export default async function DataPage() {
  const session = await getSessionUser();
  const user = session ? await db.user.findUnique({ where: { id: session.id }, select: { email: true, emailOptOut: true, passwordHash: true } }) : null;

  return (
    <LegalPage
      eyebrow="Vaša prava"
      title="Moji podaci i brisanje"
      personal
      intro="Svoje podatke možete preuzeti, ispraviti i trajno obrisati, bez obrazloženja i bez čekanja."
    >
      {user ? (
        <>
          <h2>Preuzmite svoje podatke</h2>
          <p>Dobijate PDF sa podacima o nalogu, terminima, ocenama, listi čekanja i porukama.</p>
          <p>
            <a href="/api/account/export" className="btn-secondary">
              Preuzmi moje podatke
            </a>
          </p>

          <h2>Mejlovi</h2>
          <form action={setEmailOptOut} className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm">
              Podsetnici za termine, obaveštenja sa liste čekanja i zamolbe za ocenu: <strong>{user.emailOptOut ? "isključeni" : "uključeni"}</strong>.
              Svaki takav mejl ima i link za odjavu.
            </p>
            <input type="hidden" name="optOut" value={user.emailOptOut ? "0" : "1"} />
            <button className="btn-secondary btn-sm">{user.emailOptOut ? "Uključi ponovo" : "Isključi"}</button>
          </form>

          <h2>Ispravka podataka</h2>
          <p>
            Ime i telefon menjate na stranici <Link href="/nalog/profil">Profil</Link>.
          </p>

          <h2>Obrišite nalog</h2>
          <p>Brisanjem se trajno uklanjaju:</p>
          <ul>
            <li>ime, email, telefon, lozinka, slika i veza sa Google nalogom;</li>
            <li>vaše poruke salonima i lista čekanja;</li>
            <li>beleške salona o vama i oznake za zakazivanje;</li>
            <li>budući termini (otkazuju se); prošli termini ostaju salonu samo kao anonimni zapis bez imena i telefona;</li>
            <li>vaše ocene ostaju bez vašeg imena.</li>
          </ul>
          <p>Ovo se ne može poništiti.</p>
          <DeleteForm askPassword={Boolean(user.passwordHash)} />
        </>
      ) : (
        <>
          <h2>Imate nalog</h2>
          <p>
            <Link href="/prijava?next=/brisanje-podataka">Prijavite se</Link> i na ovoj stranici možete preuzeti podatke ili
            obrisati nalog jednim klikom.
          </p>
          <h2>Zakazivali ste bez naloga</h2>
          <p>
            Pošaljite email na <Detail value={COMPANY.email} /> sa istog broja telefona ili imena koje ste upisali pri
            zakazivanju, i navedite šta tražite (pregled, ispravka ili brisanje). Odgovaramo bez odlaganja, a najkasnije u roku
            od 30 dana. Radi zaštite vaših podataka možemo tražiti da potvrdite identitet.
          </p>
          <p>Salon može da zadrži samo ono što mora po zakonu (npr. fiskalne račune).</p>
        </>
      )}
    </LegalPage>
  );
}
