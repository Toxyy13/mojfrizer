# mojfrizer.com — plan

Jedna aplikacija (Next.js + TypeScript + PostgreSQL + Prisma) za sve salone. Svaki salon dobija stranicu `mojfrizer.com/s/{slug}`, npr. `mojfrizer.com/s/kod-olgice`, i poddomen `kod-olgice.mojfrizer.com` (`src/proxy.ts`). Novi salon = novi red u bazi, bez novog koda.

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
1. **Šema baze + početni podaci za Kod Olgice** — urađeno.
2. **Logika zakazivanja** — urađeno (`src/lib/booking.ts`): slobodni termini iz radnog vremena, pauza i neradnih dana; zaštita od duplih termina u transakciji i u samoj bazi (`appointments_no_overlap`).
3. **Pazar** — urađeno (`src/lib/revenue.ts`): zbir završenih termina za dan i mesec, računa server.
4. **Frontend** — urađeno osnovno:
   - `/` pretraga salona po imenu i gradu;
   - `/s/{slug}` stranica salona: adresa, mapa, radno vreme, cenovnik, online zakazivanje (gost samo sa imenom i telefonom, ili ulogovana mušterija);
   - `/prijava` login: svi emailom (stari nalozi sa telefonom mogu i telefonom); salon ide u admin, mušterija na svoj omiljeni salon;
   - `/registracija` nalog mušterije (ime, email, lozinka, telefon nije obavezan); `/nalog` omiljeni salon i termini mušterije; dugme „omiljeni salon” na početnoj i na stranici salona;
   - chat salon–mušterija: mušterija piše sa `/poruke/{slug}` (dugme na stranici salona, razgovori u `/nalog`), salon odgovara u `/admin/{slug}/poruke`; nepročitane poruke se broje, stranica se osvežava na 5 s (kasnije pravi real-time, Pusher/Supabase);
   - `/admin/{slug}` raspored za dan po frizeru, statusi, upis termina za mušteriju koja zove telefonom, pazar.

Email podsetnik: `GET /api/cron/reminders` (zaštićen `CRON_SECRET`-om) šalje mušterijama sa nalogom mejl za termine u narednih 24h, jednom po terminu. Treba ga zvati svakih ~30 min (cron na hostingu), a slanje traži `RESEND_API_KEY` i `MAIL_FROM` (bez ključa se mejl samo ispiše u log). Gosti bez naloga nemaju email, pa nemaju ni podsetnik.

Sledeće: zaboravljena lozinka, potvrda emaila, podešavanja salona (cenovnik, radno vreme, neradni dani) u adminu, SMS/Viber podsetnici, chat.

## Pokretanje lokalno
```
cp .env.example .env      # upiši DATABASE_URL i AUTH_SECRET
npm install
npm run db:migrate        # pravi tabele
npm run db:seed           # ubacuje Kod Olgice
npm run dev               # http://localhost:3000/s/kod-olgice
```
Baza mora da dozvoli ekstenziju `btree_gist` (Neon, Supabase i običan Postgres je imaju).
Demo nalozi (lozinka `promeni-me`): `olgica@mojfrizer.com` (vlasnica), mušterija `milica@example.com` (omiljeni salon Kod Olgice).
