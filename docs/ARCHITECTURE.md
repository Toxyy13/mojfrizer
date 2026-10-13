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

## 5. KEŠIRANJE I PREUZIMANJA
- Sve stranice sa podacima o prijavljenom korisniku, salonu ili terminu su `force-dynamic` i idu sa `Cache-Control: private, no-store`. Ništa lično ni privatno se ne kešira na CDN-u ni deli između korisnika.
- Statične stranice (uslovi, privatnost, kolačići, povraćaj, licence, o nama) su prerenderovane i služe se sa CDN-a. Zato koriste `SiteHeader generic` (bez čitanja sesije). Stranica koja prikazuje lične podatke mora imati `<LegalPage personal>`.
- Slobodni termini (`/api/salons/[slug]/slots`) su uvek `no-store`: zavise od svakog novog termina i od toga ko pita (privatni saloni, režim osoblja).
- Javna stranica salona i početna zavise od sesije (prijava, omiljeni, privatni saloni), pa se ne mogu keširati javno. Upiti se dele samo unutar jednog zahteva (`react cache`).
- Preuzimanja: `.ics` termina (`/termin/[token]/kalendar.ics`, `private, no-store`, tajni link), izvoz podataka (`/api/account/export`, `private, no-store`), QR plakat (`/admin/[slug]/qr/slika?format=png|svg&v=<otisak tokena>`, generiše se na zahtev, `private, max-age=1 godina, immutable` jer se `v` menja kad se token obnovi). Slika profila: `?v=` je vreme izmene, pa je `immutable`.
