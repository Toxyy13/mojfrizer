import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Licence · mojfrizer", description: "Fontovi, slike i softver koje koristi mojfrizer.com i pod kojim licencama." };

export default function LicensesPage() {
  return (
    <LegalPage
      eyebrow="Pravne informacije"
      title="Licence"
      intro="Sve što koristimo na sajtu je ili naše, ili slobodno za komercijalnu upotrebu pod licencom navedenom ispod."
    >
      <h2>Fontovi</h2>
      <p>Fontovi se isporučuju sa našeg servera; vaš pregledač ne kontaktira Google zbog njih.</p>
      <table>
        <thead>
          <tr>
            <th>Font</th>
            <th>Autori</th>
            <th>Licenca</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Bricolage Grotesque</td>
            <td>Mathieu Triay, Bricolage Grotesque Project Authors</td>
            <td>SIL Open Font License 1.1 (dozvoljena komercijalna upotreba)</td>
          </tr>
          <tr>
            <td>Plus Jakarta Sans</td>
            <td>Tokotype, Plus Jakarta Sans Project Authors</td>
            <td>SIL Open Font License 1.1 (dozvoljena komercijalna upotreba)</td>
          </tr>
        </tbody>
      </table>

      <h2>Slike i ikone</h2>
      <ul>
        <li>Logo „moj frizer”, ikone i ilustracije na sajtu su naše i sastavljene od teksta i vektorskih oblika; ne koristimo tuđe fotografije.</li>
        <li>Slika profila i sve što otpremite ostaje vaše vlasništvo; koristimo ga samo da ga prikažemo vama i salonima kod kojih ste bili.</li>
        <li>Znak Google u dugmetu za prijavu je Googleov zaštitni znak i prikazan je prema njihovim smernicama za brend.</li>
        <li>Mapa i adresa na stranici salona potiču iz usluge Google Maps.</li>
      </ul>

      <h2>Softver otvorenog koda</h2>
      <p>Sajt je napravljen pomoću sledećih biblioteka, svaka pod svojom licencom:</p>
      <table>
        <thead>
          <tr>
            <th>Biblioteka</th>
            <th>Licenca</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Next.js, React</td>
            <td>MIT</td>
          </tr>
          <tr>
            <td>Tailwind CSS</td>
            <td>MIT</td>
          </tr>
          <tr>
            <td>Prisma</td>
            <td>Apache 2.0</td>
          </tr>
          <tr>
            <td>bcryptjs</td>
            <td>BSD-3-Clause</td>
          </tr>
          <tr>
            <td>jose, zod, qrcode</td>
            <td>MIT</td>
          </tr>
          <tr>
            <td>Anthropic SDK</td>
            <td>MIT</td>
          </tr>
        </tbody>
      </table>
    </LegalPage>
  );
}
