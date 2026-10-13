import type { Metadata } from "next";
import Link from "next/link";
import { Detail, LegalPage } from "@/components/LegalPage";
import { COMPANY, MIN_AGE } from "@/lib/company";

export const metadata: Metadata = {
  title: "Uslovi korišćenja · mojfrizer",
  description: "Pravila korišćenja platforme mojfrizer.com za mušterije i salone.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Pravne informacije"
      title="Uslovi korišćenja"
      intro="Kratko: mojfrizer.com povezuje vas i frizerski salon. Uslugu pruža i naplaćuje salon, a mi brinemo da zakazivanje radi."
    >
      <h2>1. O nama</h2>
      <p>
        Platformu mojfrizer.com vodi <Detail value={COMPANY.name} />, <Detail value={COMPANY.address} />, PIB{" "}
        <Detail value={COMPANY.pib} />, matični broj <Detail value={COMPANY.registryNumber} />, email{" "}
        <Detail value={COMPANY.email} />. Korišćenjem sajta prihvatate ove uslove i{" "}
        <Link href="/privatnost">Politiku privatnosti</Link>.
      </p>

      <h2>2. Šta je mojfrizer.com</h2>
      <p>
        mojfrizer.com je softver za online zakazivanje. Saloni na njemu objavljuju cenovnik, radno vreme i slobodne termine, a
        mušterije zakazuju. Ugovor o frizerskoj usluzi zaključujete direktno sa salonom; mi nismo strana u tom ugovoru i ne
        odgovaramo za kvalitet usluge salona. Cene, opise usluga i radno vreme unosi salon i salon odgovara za njihovu tačnost.
      </p>

      <h2>3. Nalog i uzrast</h2>
      <ul>
        <li>Za zakazivanje nalog nije obavezan; dovoljni su ime i broj telefona.</li>
        <li>
          Nalog može samostalno da otvori osoba koja ima najmanje {MIN_AGE} godina. Za mlađe termin zakazuje roditelj ili
          staratelj.
        </li>
        <li>Podaci koje unosite moraju biti tačni. Lozinku čuvate sami i ne delite je.</li>
        <li>
          Nalog možete obrisati u svakom trenutku na stranici <Link href="/brisanje-podataka">Brisanje podataka</Link>.
        </li>
      </ul>

      <h2>4. Cene i plaćanje</h2>
      <ul>
        <li>Korišćenje mojfrizer.com je za mušterije besplatno. Ne naplaćujemo proviziju ni rezervaciju.</li>
        <li>
          Cene su u dinarima, onako kako ih je salon uneo, i to je cena koju plaćate u salonu. Ako usluga ima nižu cenu uz drugu
          uslugu istog dana, to piše u cenovniku pre zakazivanja.
        </li>
        <li>Plaćanje se obavlja u salonu, na način koji salon prihvata. Online plaćanje za sada ne postoji.</li>
      </ul>

      <h2>5. Zakazivanje, otkazivanje i nedolazak</h2>
      <ul>
        <li>Termin je zakazan kada vidite potvrdu na ekranu. Link iz potvrde služi za otkazivanje i pomeranje.</li>
        <li>
          Termin možete besplatno otkazati ili pomeriti online do roka koji je salon odredio (prikazan je na stranici termina),
          a posle toga pozivom ili porukom salonu.
        </li>
        <li>
          Ako više puta ne dođete bez otkazivanja, salon može odlučiti da sledeće termine zakazujete samo telefonom.
        </li>
        <li>
          Salon može otkazati termin iz opravdanih razloga (bolest, kvar); tada vas obaveštava telefonom ili porukom.
          Detalji su u <Link href="/povracaj-novca">pravilima o otkazivanju i povraćaju</Link>.
        </li>
      </ul>

      <h2>6. Ocene i poruke</h2>
      <ul>
        <li>
          Ocenu može ostaviti samo mušterija čiji je termin salon označio kao završen, najkasnije 30 dana posle termina, jednom
          po dolasku. Zaposleni u salonu ne mogu da ocenjuju svoj salon.
        </li>
        <li>Saloni ne mogu da menjaju, sakriju ni plate uklanjanje ocene. Ocene ne kupujemo i ne izmišljamo.</li>
        <li>
          Zabranjeni su uvredljivi, lažni i nezakoniti sadržaji, kao i tuđi lični podaci u komentarima i porukama. Takav sadržaj
          uklanjamo kada za njega saznamo; prijave šaljite na <Detail value={COMPANY.email} />.
        </li>
      </ul>

      <h2>7. AI asistent</h2>
      <p>
        AI asistent odgovara na osnovu cenovnika, radnog vremena i slobodnih termina salona. Može da pogreši; važi ono što piše na
        stranici salona i u potvrdi termina. Asistent ne zakazuje i ne otkazuje termine.
      </p>

      <h2>8. Uslovi za salone</h2>
      <ul>
        <li>
          Otvaranje salona i korišćenje platforme je trenutno besplatno. Pre uvođenja bilo kakve naplate salon dobija mejlom
          cenu i uslove najmanje 30 dana unapred, i ništa se ne naplaćuje bez njegove izričite saglasnosti. Nema skrivenih
          troškova ni ugovorne obaveze.
        </li>
        <li>
          Salon odgovara za tačnost cena, radnog vremena i opisa usluga, za poštovanje zakazanih termina i za izdavanje fiskalnog
          računa.
        </li>
        <li>
          Za podatke svojih mušterija salon je rukovalac, a mi obrađivač: obrađujemo ih samo radi rada platforme, čuvamo ih
          bezbedno, ne dajemo ih trećim licima osim obrađivača navedenih u Politici privatnosti i brišemo ih kada salon prestane
          da koristi platformu. Ovaj odeljak čini ugovor o obradi podataka u smislu čl. 45 ZZPL.
        </li>
        <li>Salon ne sme da koristi podatke mušterija za reklamne poruke bez njihovog pristanka.</li>
      </ul>

      <h2>9. Dostupnost i odgovornost</h2>
      <p>
        Trudimo se da sajt radi bez prekida, ali ne garantujemo neprekidnu dostupnost. Ne odgovaramo za štetu nastalu zbog
        nedostupnosti sajta ili netačnih podataka koje je uneo salon, osim ako je šteta prouzrokovana namerno ili krajnjom
        nepažnjom. Ovim se ne ograničavaju prava potrošača po Zakonu o zaštiti potrošača.
      </p>

      <h2>10. Prekid korišćenja</h2>
      <p>
        Nalog možete obrisati kad god želite. Možemo blokirati nalog koji krši ove uslove (npr. lažna zakazivanja ili uvredljive
        poruke), uz obaveštenje mejlom.
      </p>

      <h2>11. Žalbe i sporovi</h2>
      <p>
        Prigovor na rad platforme pošaljite na <Detail value={COMPANY.email} />; odgovaramo u roku od 8 dana. Prigovor na
        frizersku uslugu upućujete salonu. Na ove uslove primenjuje se pravo Republike Srbije. Potrošač može spor rešiti i
        vansudskim putem, pred telom sa liste ministarstva nadležnog za zaštitu potrošača.
      </p>

      <h2>12. Izmene uslova</h2>
      <p>
        O bitnim izmenama obaveštavamo vas na sajtu i mejlom najmanje 15 dana pre nego što počnu da važe. Ako se ne slažete,
        možete obrisati nalog.
      </p>
    </LegalPage>
  );
}
