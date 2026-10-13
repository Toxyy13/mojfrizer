# ARCHITECTURE.md - Multi-Tenant Salon SaaS Backend

## 1. TEHNOLOŠKI STEK
- **Framework:** Next.js (App Router) sa TypeScript-om
- **Baza podataka:** PostgreSQL (Multi-tenant via Single-Database sa `salon_id` izolacijom)
- **ORM:** Prisma
- **Real-time (Chat & Live Kalendar):** Supabase Realtime ili Pusher

## 2. MULTI-TENANCY & BEZBEDNOST (Strogo pravilo!)
- Svaka tabela (osim globalnih korisnika) MORA imati `salon_id` spoljni ključ (foreign key).
- Svaki API upit, Server Action ili mutacija baze MORA prvo verifikovati sesiju korisnika i potvrditi da ulogovani korisnik ima pravo pristupa tom konkretnom `salon_id`-u. Salon A nikada ne sme videti podatke Salona B.

## 3. LOGIKA POSEBNIH MODULA
- **Sprečavanje duplih termina (Double Booking Prevention):** Pre nego što uneseš novi termin u bazu, backend mora izvršiti proveru da li za izabranog `worker_id` unutar tog `salon_id` postoji preklapanje u vremenskom opsegu (`start_time` i `end_time`).
- **Finansije i Pazar (Analytics):** 
  - Sve cene u bazi čuvati isključivo kao celi broj (`Int`) u najmanjoj valuti (npr. 1500 dinara = 150000) kako bi se izbegle JavaScript greške sa decimalnim brojevima.
  - Pazar računati isključivo na backendu agregacijom svih termina koji imaju status `completed`.
- **Chat:** Poruke se čuvaju u tabeli `chat_messages`, vezane su za `salon_id`, a prenos u realnom vremenu se radi kroz WebSockets stream.

## 4. POČETNA PRISMA ŠEMA (SCHEMA.PRISMA)
Kada te korisnik zamoli da generišeš bazu, obavezno napravi sledeće modele i relacije:
- `User` (id, email, password, role: ADMIN / WORKER / CLIENT)
- `Salon` (id, name, slug, address, ownerId)
- `WorkerProfile` (id, userId, salonId, specialities)
- `Service` (id, name, price, duration, salonId)
- `Appointment` (id, clientId, workerId, serviceId, salonId, startTime, endTime, status)
- `ChatMessage` (id, text, senderId, salonId, createdAt)

## 5. ROW LEVEL SECURITY (RLS)
Baza sama odbija tuđe redove, čak i ako neki upit zaboravi `where salonId`. To je druga linija odbrane iznad provera u `src/lib/access.ts` (one ostaju).
- **Migracija** `*_row_level_security`: uključuje RLS na svim tabelama, pravi ulogu `mojfrizer_app` (bez BYPASSRLS) i politike. Pomoćne SQL funkcije: `app_uid()`, `app_sys()`, `app_is_owner()`, `app_is_staff()`, `app_can_view()` (javni saloni su vidljivi svima, privatni samo osoblju, developeru i mušterijama koje su skenirale QR), `app_user_visible()`.
- **Uključivanje**: sa `RLS_ENFORCE=1` svaki upit ide u kratku transakciju koja prvo kaže bazi ko pita (`set_config('role', 'mojfrizer_app')`, `app.uid`, `app.sys`, `app.devclaim`), videti `src/lib/db.ts` i `src/lib/rls.ts`. Bez te promenljive aplikacija se konektuje kao vlasnik tabela, koga PostgreSQL ne ograničava, pa se ništa ne menja. Migracije, seed i skripte uvek koriste vlasnika.
- **Ko pita**: prijavljen korisnik se čita iz kolačića (JWT), posetilac je „niko”. Mimo zahteva (skripte, testovi) takođe „niko”.
- **Pravila**: vlasnik salona vidi i menja samo redove svog salona; frizerski nalog vidi raspored svog salona, ali ne poruke i beleške; mušterija vidi samo svoje termine, poruke, listu čekanja i profil; posetilac vidi samo javne salone, njihov cenovnik, radno vreme i ocene. Tokeni za mejl i evidencija asistenta nisu čitljivi ni za jednog korisnika.
- **Eksplicitni sistemski pristup** (zaobilazi RLS, samo za pouzdan interni kod, uvek posle provere ovlašćenja): `runAsSystem(fn)` iz `rls.ts` ili klijent `systemDb` iz `db.ts`. Koristi se za: prijavu, registraciju i tokene za mejl (`auth.ts`, `emailTokens.ts`, `accountMail.ts`, `google.ts`, `unsubscribe.ts`), zakazivanje u ime posetioca (`booking.ts`: slobodni termini i upis termina, `urgent.ts`: hitni zahtev, `clients.ts`: `isBlockedOnline`), upravljanje terminom preko tajnog linka (`manageBooking.ts`, `reviews.ts`), obaveštenja liste čekanja, cron (`reminders.ts`, `retention.ts`), brisanje naloga, QR pristup (`connectCustomerToSalon`, `/q/[token]`), pravljenje naloga frizera. Developer panel radi nad svim salonima: kolačić sa ulogom DEVELOPER daje sistemski pristup samo dok baza i dalje kaže da je korisnik developer (`app_sys()`).
- **Nova tabela**: u istoj migraciji uključiti RLS i napisati politike, inače pada test `rls.test.ts` („every table is protected”). **Nov kod koji čita tuđe redove u ime posetioca** mora koristiti sistemski pristup; ako upit „odjednom ne vraća ništa” sa uključenim RLS-om, razlog je ovde.
- **Cena**: sa uključenim RLS-om svaki upit ima 2 dodatna kruga ka bazi (set uloge + commit). Na Neon-u u istom regionu kao Vercel to je nekoliko milisekundi po upitu.
- **Testovi**: `src/lib/__tests__/rls.test.ts` (jedan salon ne vidi drugi, posetilac, privatni saloni, sistemski pristup) i `rlsFlows.test.ts` (pravi kod za zakazivanje, chat, nalog i cron pod RLS-om). Rade nad PostgreSQL-om iz `DATABASE_URL`.

## 6. KEŠIRANJE I PREUZIMANJA
- Sve stranice sa podacima o prijavljenom korisniku, salonu ili terminu su `force-dynamic` i idu sa `Cache-Control: private, no-store`. Ništa lično ni privatno se ne kešira na CDN-u ni deli između korisnika.
- Statične stranice (uslovi, privatnost, kolačići, povraćaj, licence, o nama) su prerenderovane i služe se sa CDN-a. Zato koriste `SiteHeader generic` (bez čitanja sesije). Stranica koja prikazuje lične podatke mora imati `<LegalPage personal>`.
- Slobodni termini (`/api/salons/[slug]/slots`) su uvek `no-store`: zavise od svakog novog termina i od toga ko pita (privatni saloni, režim osoblja).
- Javna stranica salona i početna zavise od sesije (prijava, omiljeni, privatni saloni), pa se ne mogu keširati javno. Upiti se dele samo unutar jednog zahteva (`react cache`).
- Preuzimanja: `.ics` termina (`/termin/[token]/kalendar.ics`, `private, no-store`, tajni link), izvoz podataka (`/api/account/export`, `private, no-store`), QR plakat (`/admin/[slug]/qr/slika?format=png|svg&v=<otisak tokena>`, generiše se na zahtev, `private, max-age=1 godina, immutable` jer se `v` menja kad se token obnovi). Slika profila: `?v=` je vreme izmene, pa je `immutable`.
