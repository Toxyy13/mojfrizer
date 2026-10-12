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
