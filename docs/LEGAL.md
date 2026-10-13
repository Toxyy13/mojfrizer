# LEGAL.md - Pravna usklađenost (Srbija, ZZPL / GDPR-kompatibilno)

Stranice (src/app): `/uslovi`, `/privatnost`, `/kolacici`, `/povracaj-novca`, `/brisanje-podataka`, `/o-nama`, `/licence`.
Tekstovi su nacrti prilagođeni onome što kod zaista radi; pravnik ih mora pregledati pre prodaje salonima.

## Pravila za svaku novu funkciju
- Novi podatak o ličnosti: upisati u tabelu u `/privatnost` (svrha, osnov, rok čuvanja), u `src/lib/accountDeletion.ts` (brisanje i izvoz) i `src/lib/retention.ts` (rok).
- Novi spoljni servis (SDK, embed, font sa CDN-a): upisati u listu obrađivača u `/privatnost`; ako postavlja kolačiće ili šalje IP trećoj strani, učitavati ga tek posle pristanka (primer: `MapEmbed`).
- Opcioni mejl (podsetnik, obaveštenje): `sendMail({ unsubscribe })` i poštovati `User.emailOptOut`. Mejlovi o nalogu (potvrda, lozinka) ne traže odjavu.
- Nema unapred štikliranih polja, lažne hitnosti ni cene koja se pojavi tek na kraju.
- Ocene samo posle završenog termina; ne izmišljati ocene, brojeve salona ni tvrdnje tipa "najbolji".
- Uzrast: 15 godina (ZZPL čl. 16). Menja se samo u `MIN_AGE` (`src/lib/company.ts`).

## Podaci o firmi
`src/lib/company.ts`: naziv, adresa, PIB, matični broj. Dok su u uglastim zagradama, istaknuti su na `/o-nama` i sakriveni u podnožju. Email za kontakt: env `NEXT_PUBLIC_CONTACT_EMAIL`.
Pri izmeni tekstova promeniti `LEGAL_UPDATED` i `TERMS_VERSION`.

## Čuvanje podataka
`/api/cron/reminders` posle podsetnika poziva `purgeExpiredData()`: termini stariji od 24 meseca gube ime, telefon i napomenu, poruke se brišu posle 24 meseca, hitni zahtevi posle 12, istekli tokeni posle 7 dana.
