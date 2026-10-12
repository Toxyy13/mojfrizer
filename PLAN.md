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
   - `/admin/{slug}` raspored za dan po frizeru, statusi, upis termina za mušteriju koja zove telefonom, pazar;
   - `/admin/{slug}/podesavanja` (samo vlasnik): cenovnik (dodaj, izmeni, skloni uslugu), radno vreme sa pauzom, neradni dani i odmor, radnici, podaci o salonu.

„Nastavi sa Google nalogom” (`/api/auth/google`, OAuth sa PKCE): dugme na prijavi i registraciji se pojavi čim su `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` podešeni. Novi Google nalog postaje mušterija; ako nalog sa istom (Google-potvrđenom) email adresom već postoji, povezuje se sa njim. Podešavanje: Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application), u „Authorized redirect URIs” upisati `https://mojfrizer.com/api/auth/google/callback` (i `http://localhost:3000/api/auth/google/callback` za razvoj), a `APP_URL` mora biti javna adresa sajta.

Moj termin: posle online zakazivanja mušterija dobija link `/termin/{token}` (na ekranu, a sa nalogom i mejlom potvrde). Preko njega otkazuje ili pomera termin (do `cancelCutoffHours` sati pre, podešava salon) i dodaje ga u kalendar telefona (`.ics`). Vlasnik dobija mejl za svako otkazivanje i pomeranje.

Profil mušterije (`/nalog/profil`): ime, telefon (obavezan za profil, banner na `/nalog` dok ga nema) i profilna slika (u bazi, `user_avatars`, JPG/PNG/WebP do 1 MB, u browseru se smanji na 400×400). Salon vidi telefon i sliku mušterije u rasporedu i u porukama; sliku (`/api/avatar/{id}`) mogu da otvore samo vlasnik naloga i osoblje salona sa kojim je mušterija imala termin, hitan zahtev ili razgovor.

Mušterije salona (`/admin/{slug}/musterije`): spisak svih mušterija (gosti i nalozi, spojeni po poslednjih 8 cifara telefona) sa brojem dolazaka, potrošnjom, nedolascima, poslednjim i sledećim terminom; karton mušterije sa istorijom, beleškom salona i opcijom „samo telefonom" (blokira online zakazivanje, npr. posle više nedolazaka). Raspored prikazuje belešku i broj nedolazaka.

Email podsetnik: `GET /api/cron/reminders` (zaštićen `CRON_SECRET`-om) šalje mušterijama sa nalogom mejl za termine u narednih 24h, jednom po terminu. Treba ga zvati svakih ~30 min (cron na hostingu), a slanje traži `RESEND_API_KEY` i `MAIL_FROM` (bez ključa se mejl samo ispiše u log). Gosti bez naloga nemaju email, pa nemaju ni podsetnik.

Email nalozi: posle registracije stiže mejl sa linkom za potvrdu adrese (`/potvrda-emaila`, važi 48 h; banner i „Pošalji ponovo” na `/nalog`), a podsetnici idu samo na potvrđene adrese (Google nalozi su odmah potvrđeni). „Zaboravljena lozinka” (`/zaboravljena-lozinka` → mejl → `/nova-lozinka`, link važi 1 h i jednokratan je); odgovor je uvek isti, da se ne vidi koji mejlovi imaju nalog, a na minut se šalje najviše jedan mejl po nalogu. Tokeni su u bazi samo kao hash (`email_tokens`).

Bez SMS-a: podsetnici i potvrde idu samo emailom.

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
