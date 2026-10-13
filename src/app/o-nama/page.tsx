import type { Metadata } from "next";
import { Detail, LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Podaci o firmi · mojfrizer", description: "Ko stoji iza mojfrizer.com i kako nas kontaktirati." };

export default function AboutPage() {
  return (
    <LegalPage eyebrow="Pravne informacije" title="Podaci o firmi" intro="Ko vodi mojfrizer.com i kako nas možete kontaktirati.">
      <dl className="card grid gap-3 p-5 sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted">Naziv</dt>
        <dd>
          <Detail value={COMPANY.name} />
        </dd>
        <dt className="text-muted">Sedište</dt>
        <dd>
          <Detail value={COMPANY.address} />
        </dd>
        <dt className="text-muted">PIB</dt>
        <dd>
          <Detail value={COMPANY.pib} />
        </dd>
        <dt className="text-muted">Matični broj</dt>
        <dd>
          <Detail value={COMPANY.registryNumber} />
        </dd>
        <dt className="text-muted">Email</dt>
        <dd>
          <Detail value={COMPANY.email} />
        </dd>
        <dt className="text-muted">Sajt</dt>
        <dd>{COMPANY.website}</dd>
      </dl>
      <p>
        Za pitanja o podacima o ličnosti i zahteve za brisanje koristite isti email. Pitanja o terminu i usluzi uputite direktno
        salonu; njegovi kontakti su na njegovoj stranici.
      </p>
    </LegalPage>
  );
}
