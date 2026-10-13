import type { Metadata } from "next";
import Link from "next/link";
import { ConsentSettings } from "@/components/ConsentSettings";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Kolačići · mojfrizer", description: "Koje kolačiće koristi mojfrizer.com i kako ih birate." };

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Pravne informacije"
      title="Kolačići"
      intro="Ne koristimo reklamne ni analitičke kolačiće i ne pratimo vas na drugim sajtovima. Jedini opcioni kolačići dolaze sa Google mapom i učitavaju se samo ako to dozvolite."
    >
      <h2>Šta koristimo</h2>
      <table>
        <thead>
          <tr>
            <th>Naziv</th>
            <th>Vrsta</th>
            <th>Čemu služi</th>
            <th>Traje</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>mf_session</td>
            <td>Neophodan</td>
            <td>Drži vas prijavljenima</td>
            <td>7 dana</td>
          </tr>
          <tr>
            <td>mf_oauth</td>
            <td>Neophodan</td>
            <td>Zaštita prijave Google nalogom (samo tokom prijave)</td>
            <td>10 minuta</td>
          </tr>
          <tr>
            <td>mf_consent</td>
            <td>Neophodan</td>
            <td>Pamti vaš izbor o kolačićima</td>
            <td>180 dana</td>
          </tr>
          <tr>
            <td>Kolačići Googlea (Google Maps)</td>
            <td>Opcioni, samo uz vaš pristanak</td>
            <td>Prikaz mape na stranici salona; njih postavlja Google, pod svojim uslovima</td>
            <td>Prema Googleu</td>
          </tr>
        </tbody>
      </table>
      <p>
        Neophodni kolačići ne traže pristanak jer bez njih prijava ne radi. Ako ne dozvolite mapu, na stranici salona vidite adresu i
        link „Uputstva do salona”. Mapu možete jednokratno prikazati i bez dozvole.
      </p>

      <p>
        Praćenje grešaka (Sentry) radi samo na našem serveru i ne postavlja kolačiće ni skripte u vašem pregledaču.
      </p>

      <h2>Vaš izbor</h2>
      <ConsentSettings />
      <p>
        Kolačiće možete obrisati i u podešavanjima pregledača. Više o obradi podataka u{" "}
        <Link href="/privatnost">Politici privatnosti</Link>.
      </p>
    </LegalPage>
  );
}
