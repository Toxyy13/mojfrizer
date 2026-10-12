# mojfrizer.com — plan

Jedna aplikacija (Next.js + TypeScript + PostgreSQL + Prisma) za sve salone. Svaki salon dobija stranicu `mojfrizer.com/s/{slug}`, npr. `mojfrizer.com/s/kod-olgice`. Novi salon = novi red u bazi, bez novog koda.

## Kako su zahtevi pokriveni u bazi
| Zahtev | Gde u šemi |
|---|---|
| Pretraga salona | `Salon.name`, `Salon.city` (indeks po gradu) |
| Omiljeni salon, posle logina ide pravo na njega | `User.favoriteSalonId` |
| Cenovnik | `Service` (cena u parama, trajanje u minutima) |
| Adresa, telefon | `Salon.address`, `Salon.city`, `Salon.phone` |
| Radno vreme | `WorkingHours` (više redova po danu = pauza), `SalonDayOff` (praznici, odmor) |
| Dostupnost termina | računa se iz radnog vremena minus zauzeti `Appointment` po frizeru |
| Mušterija sama zakazuje | `Appointment.source = ONLINE`, `clientId` = njen nalog |
| Salon zakazuje umesto mušterije | `Appointment.source = SALON`, bez naloga: `guestName` + `guestPhone` |
| Pazar | zbir `Appointment.price` sa statusom `COMPLETED` |

## Faze (redosled iz CONVENTIONS.md)
1. **Šema baze + početni podaci za Kod Olgice** — urađeno, testirano na Postgres bazi.
2. Logika zakazivanja: slobodni termini, provera preklapanja, otkazivanje.
3. Servis za pazar i analitiku.
4. Frontend (DESIGN.md): početna sa pretragom, stranica salona, zakazivanje, login, panel za salon.

## Pokretanje lokalno
```
cp .env.example .env      # upiši DATABASE_URL
npm install
npm run db:migrate        # pravi tabele
npm run db:seed           # ubacuje Kod Olgice
```
Demo nalozi (lozinka `promeni-me`): `olgica@mojfrizer.com` (vlasnica), mušterija Milica sa telefonom `064 123 4567` (omiljeni salon Kod Olgice).

## Nalozi mušterija
- `/register`: ime, broj telefona i lozinka. `/login`: mušterije telefonom, saloni email adresom.
- Posle prijave: omiljeni salon (`/s/{slug}`), pa panel salona za vlasnike i radnike, inače `/search`.
- `/search`: pretraga po nazivu, gradu ili ulici, uz dugme za omiljeni salon.
- `/account`: omiljeni salon, predstojeći i raniji termini.
- Zakazivanje bez naloga i dalje radi. Telefon se za sada ne potvrđuje SMS-om.
