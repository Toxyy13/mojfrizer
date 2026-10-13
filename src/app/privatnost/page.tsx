import type { Metadata } from "next";
import Link from "next/link";
import { Detail, LegalPage } from "@/components/LegalPage";
import { COMPANY, MIN_AGE } from "@/lib/company";

export const metadata: Metadata = {
  title: "Politika privatnosti · mojfrizer",
  description: "Koje podatke mojfrizer.com obrađuje, zašto, koliko dugo i kako ih možete obrisati.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Pravne informacije"
      title="Politika privatnosti"
      intro="Prikupljamo samo ono što je potrebno da zakažete termin i da salon zna ko dolazi. Ne prodajemo podatke, ne prikazujemo reklame i ne pratimo vas po internetu."
    >
      <h2>1. Ko obrađuje vaše podatke</h2>
      <p>
        Platformu mojfrizer.com vodi <Detail value={COMPANY.name} />, <Detail value={COMPANY.address} />, PIB{" "}
        <Detail value={COMPANY.pib} />, matični broj <Detail value={COMPANY.registryNumber} /> (u daljem tekstu: „mi”). Za sva
        pitanja o podacima pišite na <Detail value={COMPANY.email} />.
      </p>
      <p>Podatke obrađujemo u skladu sa Zakonom o zaštiti podataka o ličnosti Republike Srbije (ZZPL) i, gde se primenjuje, Opštom uredbom EU o zaštiti podataka (GDPR).</p>

      <h2>2. Ko je za šta odgovoran</h2>
      <ul>
        <li>
          <strong>Za vaš nalog na mojfrizer.com</strong> (prijava, profil, omiljeni salon, podsetnici) mi smo rukovalac.
        </li>
        <li>
          <strong>Za termine, poruke i karton mušterije u jednom salonu</strong> rukovalac je taj salon. Mi te podatke čuvamo i
          obrađujemo samo po nalogu salona, kao obrađivač, i ne koristimo ih ni za šta drugo. Salon A nikada ne vidi podatke
          salona B.
        </li>
      </ul>

      <h2>3. Koje podatke obrađujemo i zašto</h2>
      <table>
        <thead>
          <tr>
            <th>Podaci</th>
            <th>Svrha</th>
            <th>Pravni osnov</th>
            <th>Koliko čuvamo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ime, email, lozinka (samo šifrovani otisak), telefon i slika ako ih unesete, Google ID ako se prijavite Google nalogom</td>
            <td>Vaš nalog i prijava</td>
            <td>Izvršenje ugovora (Uslovi korišćenja)</td>
            <td>Dok ne obrišete nalog</td>
          </tr>
          <tr>
            <td>Ime, telefon, usluga, frizer, vreme, cena i napomena uz termin</td>
            <td>Zakazivanje i dolazak u salon</td>
            <td>Izvršenje ugovora sa salonom</td>
            <td>24 meseca posle termina, zatim brišemo ime, telefon i napomenu (ostaje samo anonimna statistika salona)</td>
          </tr>
          <tr>
            <td>Poruke koje razmenite sa salonom</td>
            <td>Dogovor oko termina</td>
            <td>Izvršenje ugovora</td>
            <td>24 meseca, ili dok ne obrišete nalog</td>
          </tr>
          <tr>
            <td>Ocena, komentar i javno ime u obliku „Ime P.”</td>
            <td>Utisci drugih mušterija</td>
            <td>Vaš pristanak (ocenu ostavljate sami)</td>
            <td>Dok ne obrišete ocenu ili nalog; posle brisanja naloga ocena ostaje bez imena</td>
          </tr>
          <tr>
            <td>Hitan zahtev (ime, telefon, razlog) i lista čekanja</td>
            <td>Pronalaženje termina kad je dan pun</td>
            <td>Izvršenje ugovora</td>
            <td>Lista čekanja do tog dana, hitni zahtevi 12 meseci</td>
          </tr>
          <tr>
            <td>Beleška salona o mušteriji i oznaka „samo telefonom” (npr. posle više nedolazaka)</td>
            <td>Organizacija rada salona</td>
            <td>Legitimni interes salona</td>
            <td>Dok salon ne obriše belešku ili ne prestane da koristi platformu</td>
          </tr>
          <tr>
            <td>Email adresa za podsetnike i obaveštenja sa liste čekanja</td>
            <td>Podsetnik pre termina</td>
            <td>Izvršenje ugovora; možete se odjaviti jednim klikom</td>
            <td>Dok postoji nalog</td>
          </tr>
          <tr>
            <td>Jednokratni linkovi za potvrdu emaila i novu lozinku (samo šifrovani otisak)</td>
            <td>Bezbednost naloga</td>
            <td>Izvršenje ugovora</td>
            <td>Najviše 7 dana posle isteka</td>
          </tr>
          <tr>
            <td>IP adresa i tehnički zapisi servera</td>
            <td>Zaštita od zloupotrebe i otklanjanje grešaka</td>
            <td>Legitimni interes</td>
            <td>IP za ograničenje broja pitanja AI asistentu samo u radnoj memoriji do 10 minuta; zapisi hostinga prema roku provajdera</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ne tražimo datum rođenja, adresu stanovanja, JMBG ni podatke o plaćanju. Broj telefona pri registraciji nije obavezan.
      </p>

      <h2>4. AI asistent</h2>
      <p>
        Kada postavite pitanje AI asistentu, tekst pitanja i javni podaci salona (cenovnik, radno vreme, slobodni termini) šalju
        se kompaniji Anthropic radi sastavljanja odgovora. Razgovore ne čuvamo, a Anthropic ih prema svojim uslovima ne koristi
        za treniranje modela. Asistent ne traži lične podatke; molimo vas da u pitanja ne upisujete ime, telefon ni zdravstvene
        podatke. Asistent ne donosi odluke o vama i ne zakazuje termine umesto vas.
      </p>

      <h2>5. Kome dajemo podatke</h2>
      <p>Podatke ne prodajemo i ne dajemo oglašivačima. Pristup imaju samo:</p>
      <ul>
        <li>salon u kome zakazujete (samo podaci o vašim terminima i porukama sa tim salonom);</li>
        <li>naši obrađivači, sa kojima imamo ugovor i koji podatke koriste samo za nas:</li>
      </ul>
      <table>
        <thead>
          <tr>
            <th>Obrađivač</th>
            <th>Za šta</th>
            <th>Gde</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel Inc.</td>
            <td>Hosting sajta</td>
            <td>SAD / EU</td>
          </tr>
          <tr>
            <td>Neon Inc.</td>
            <td>Baza podataka</td>
            <td>SAD / EU, prema regionu baze</td>
          </tr>
          <tr>
            <td>Resend (Plus Five Five, Inc.)</td>
            <td>Slanje mejlova (potvrda emaila, nova lozinka, podsetnici)</td>
            <td>SAD</td>
          </tr>
          <tr>
            <td>Google LLC</td>
            <td>Prijava Google nalogom (samo ako je izaberete); mapa salona (samo ako je dozvolite)</td>
            <td>SAD</td>
          </tr>
          <tr>
            <td>Anthropic PBC</td>
            <td>AI asistent (samo tekst pitanja)</td>
            <td>SAD</td>
          </tr>
        </tbody>
      </table>
      <p>
        Prenos u SAD se zasniva na standardnim ugovornim klauzulama i drugim merama zaštite koje ovi provajderi nude, u skladu sa
        čl. 64 i 65 ZZPL. Podatke dajemo državnim organima samo kada to zakon nalaže.
      </p>

      <h2>6. Kolačići</h2>
      <p>
        Koristimo samo kolačiće neophodne za prijavu i pamćenje vašeg izbora. Mapa salona (Google Maps) se učitava tek kada je
        dozvolite. Detalji su na stranici <Link href="/kolacici">Kolačići</Link>.
      </p>

      <h2>7. Vaša prava</h2>
      <p>Imate pravo da:</p>
      <ul>
        <li>saznate koje podatke o vama imamo i dobijete kopiju (pravo na pristup i prenosivost);</li>
        <li>ispravite netačne podatke (ime i telefon menjate sami na stranici Profil);</li>
        <li>
          obrišete nalog i podatke: sami, na stranici <Link href="/brisanje-podataka">Brisanje podataka</Link>, odmah i bez
          obrazloženja;
        </li>
        <li>ograničite obradu ili uložite prigovor na obradu zasnovanu na legitimnom interesu;</li>
        <li>povučete pristanak (npr. obrišete ocenu) i odjavite se od mejlova jednim klikom iz svakog mejla;</li>
        <li>
          podnesete pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti, Bulevar kralja Aleksandra
          15, Beograd, <a href="https://www.poverenik.rs" rel="noreferrer">www.poverenik.rs</a>.
        </li>
      </ul>
      <p>
        Na zahteve odgovaramo bez odlaganja, a najkasnije u roku od 30 dana. Za podatke koje vodi salon (termini, karton
        mušterije) zahtev možete uputiti i salonu ili nama, a mi ćemo ga proslediti.
      </p>

      <h2>8. Deca</h2>
      <p>
        Nalog može samostalno da otvori osoba koja ima najmanje {MIN_AGE} godina. Za mlađe od {MIN_AGE} godina termin zakazuje
        roditelj ili staratelj, svojim nalogom ili telefonom. Ako saznamo da je nalog otvorilo dete mlađe od {MIN_AGE} godina bez
        saglasnosti roditelja, brišemo ga.
      </p>

      <h2>9. Bezbednost</h2>
      <p>
        Sajt radi isključivo preko šifrovane veze (HTTPS). Lozinke čuvamo samo kao bcrypt otisak, linkove iz mejlova samo kao
        otisak, a slike profila vide samo vi i saloni kod kojih ste bili. Pristup bazi imaju samo ovlašćena lica.
      </p>

      <h2>10. Automatizovano odlučivanje</h2>
      <p>Ne pravimo profile za reklame i ne donosimo automatizovane odluke koje na vas imaju pravno dejstvo.</p>

      <h2>11. Izmene</h2>
      <p>
        O bitnim izmenama ove politike obaveštavamo vas na sajtu, a vlasnike naloga i mejlom, pre nego što izmene počnu da važe.
      </p>
    </LegalPage>
  );
}
