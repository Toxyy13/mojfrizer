import type { Metadata } from "next";
import Link from "next/link";
import { Detail, LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Otkazivanje i povraćaj novca · mojfrizer",
  description: "Kako se otkazuje termin i kada se vraća novac.",
};

export default function RefundPage() {
  return (
    <LegalPage
      eyebrow="Pravne informacije"
      title="Otkazivanje i povraćaj novca"
      intro="Zakazivanje na mojfrizer.com je besplatno i ne plaćate ništa unapred. Novac plaćate salonu posle usluge, pa nema šta da vam vratimo, ali pravila su ovde jasna."
    >
      <h2>Zakazivanje je besplatno</h2>
      <p>
        Mi ne naplaćujemo mušterijama zakazivanje, proviziju ni članarinu, i ne uzimamo avans ili depozit. Nikakav iznos se ne
        skida sa kartice pri zakazivanju, jer online plaćanja ne postoji.
      </p>

      <h2>Otkazivanje i pomeranje termina</h2>
      <ul>
        <li>
          Otkazujete ili pomerate termin online, linkom „Otkaži / pomeri” iz potvrde ili sa stranice{" "}
          <Link href="/nalog">Moj nalog</Link>, besplatno, do roka koji je salon odredio (prikazan na stranici termina).
        </li>
        <li>Posle tog roka otkazivanje je moguće pozivom ili porukom salonu.</li>
        <li>Nema kazne ni naknade za otkazivanje. Salon može da vas ubuduće zamoli da zakazujete telefonom ako više puta ne dođete bez javljanja.</li>
      </ul>

      <h2>Ako salon otkaže ili kasni</h2>
      <p>
        Ako salon otkaže termin, javlja vam se telefonom ili porukom i nudi drugo vreme. Nemate nikakvu obavezu prema salonu za
        otkazan termin.
      </p>

      <h2>Plaćanje i reklamacija usluge</h2>
      <p>
        Uslugu plaćate u salonu, po ceni sa cenovnika koji ste videli pri zakazivanju. Ako niste zadovoljni uslugom, prigovor
        upućujete salonu, koji je prodavac usluge. Ako se ne dogovorite, možete nam pisati na <Detail value={COMPANY.email} />, pa
        ćemo posredovati. Za plaćanja u salonu važe prava iz Zakona o zaštiti potrošača.
      </p>

      <h2>Za salone</h2>
      <p>
        Korišćenje platforme je trenutno besplatno. Ako se uvede naplata, važiće samo uz vašu izričitu saglasnost, a neiskorišćeni
        deo unapred plaćenog perioda vraćamo srazmerno u roku od 14 dana od otkazivanja.
      </p>
    </LegalPage>
  );
}
