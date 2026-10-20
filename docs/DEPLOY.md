# Objava sajta (Vercel + Neon + Resend)

Redosled: baza, hosting, mejl, pa podsetnici. Tajne vrednosti se upisuju samo u Vercel (Settings → Environment Variables), nikad u chat ni u repo.

## 1. Baza (Neon, besplatno)
Na vercel.com u projektu: Storage → Create → Neon Postgres. Vercel sam doda `DATABASE_URL` i `DATABASE_URL_UNPOOLED`.

## 2. Hosting (Vercel)
1. Add New → Project → izaberi repo `Toxyy13/mojfrizer` (Framework: Next.js; build komanda je `vercel-build` iz `package.json`).
2. Environment Variables (Production):
   - `AUTH_SECRET`: nasumičan niz od 32+ znakova
   - `CRON_SECRET`: drugi nasumičan niz
   - `SEED_OWNER_PASSWORD`: lozinka za Olgicin admin nalog (min. 8 znakova)
   - `SEED_DEVELOPER_EMAIL` i `SEED_DEVELOPER_PASSWORD`: nalog vlasnika platforme (uloga developer, panel `/razvoj`). Svaki deploy ga napravi ili unapredi; bez ove dve promenljive se preskače. Samo on pravi naloge salona. Lozinka ide samo u Vercel, nikad u chat ni u repo.
   - `NEXT_PUBLIC_CONTACT_PHONE` i `NEXT_PUBLIC_CONTACT_EMAIL`: kontakt koji vide saloni na stranici „Dodaj svoj salon” (`/dodaj-salon`); posle promene treba novi deploy.
   - `APP_URL`: adresa sajta, dok nema domena npr. `https://mojfrizer.vercel.app`; kasnije `https://mojfrizer.com`
   - `ROOT_DOMAIN`: `mojfrizer.com` (tek kad domen postoji)
   - kasnije: `RESEND_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`
3. Deploy. Produkcijski build sam primeni migracije (`prisma migrate deploy`) i ubaci salon Kod Olgice bez demo podataka. Preview buildovi ne diraju bazu.

Prijava developera: email iz `SEED_DEVELOPER_EMAIL` + `SEED_DEVELOPER_PASSWORD`, posle prijave otvara se `/razvoj`. Lozinka se kasnije menja preko „Zaboravljena lozinka”; promena `SEED_DEVELOPER_PASSWORD` posle prve prijave ne menja lozinku.

Prijava vlasnika: `olgica@mojfrizer.com` + `SEED_OWNER_PASSWORD` (email se menja preko `SEED_OWNER_EMAIL` pre prvog deploya).

## 3. Mejl (Resend)
Nalog na resend.com, domen mojfrizer.com se potvrđuje DNS zapisima. Do tada se mejlovi samo upisuju u log (registracija radi, ali potvrde i podsetnici ne stižu). `MAIL_FROM` npr. `mojfrizer <podsetnik@mojfrizer.com>`.

## 4. Podsetnici svakih 30 min
Vercel Hobby dozvoljava cron samo jednom dnevno, pa poziv radi GitHub Actions (`.github/workflows/reminders.yml`). U GitHub repou: Settings → Secrets and variables → Actions → dodaj `APP_URL` i `CRON_SECRET` (ista vrednost kao na Vercelu).

## 5. Google prijava (opciono)
Google Cloud Console → Credentials → OAuth client ID (Web). Redirect URI: `${APP_URL}/api/auth/google/callback`. `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` u Vercel; dugme se pojavi samo kad su upisani.

## 6. Praćenje grešaka (Sentry, besplatno)
Greške servera idu na vaš Sentry nalog; saloni i mušterije ništa ne vide. U Sentry-ju se šalju samo tip greške, tehnički opis i naziv stranice. Imena, mejlovi, telefoni, tekst poruka, lozinke i tajni linkovi se uklanjaju pre slanja (`src/lib/sentryScrub.ts`). Nema browser SDK-a, pa ništa ne ide iz pregledača posetilaca. Bez `SENTRY_DSN` sve ostaje isključeno.
1. Nalog na sentry.io (Developer plan je besplatan). Region EU ako ponudi.
2. Create Project → platforma **Next.js** → naziv `mojfrizer`. Preskoči „wizard” koji traži izmene koda, već je ugrađeno.
3. Settings → Projects → mojfrizer → Client Keys (DSN) → kopiraj **DSN** (počinje sa `https://`).
4. Vercel → Settings → Environment Variables → `SENTRY_DSN` = taj DSN (Production). Opciono `SENTRY_PROJECT_URL` = adresa vašeg projekta u Sentry-ju (dugme „Otvori Sentry” u `/razvoj`). Novi deploy.
5. U `/razvoj` → „Praćenje grešaka” pritisni „Pošalji probnu grešku”; za par sekundi je u Sentry → Issues.
6. Sentry → Alerts: ostavi podrazumevano pravilo „nova greška → mejl”.
Opciono `SENTRY_TRACES_SAMPLE_RATE` (0 do 1, podrazumevano 0 = bez tracing-a).

## 7. Row Level Security (zaštita redova u bazi)
Migracija `row_level_security` se primeni sama pri sledećem deploy-u i **ne menja ništa dok se ne uključi prekidač**. Ako Neon odbije da napravi ulogu `mojfrizer_app`, migracija ne pada, samo upozori u logu builda; RLS se tada ne može uključiti dok se uloga ne napravi.
1. Posle deploy-a sa migracijom proveri da uloga postoji: Neon → SQL Editor → `select rolname, rolbypassrls from pg_roles where rolname = 'mojfrizer_app';` (jedan red, `rolbypassrls = f`).
2. Vercel → Settings → Environment Variables → `RLS_ENFORCE` = `1` (Production). Novi deploy. Ne treba druga baza ni druga lozinka: aplikacija se u svakom upitu prebaci na ograničenu ulogu.
3. Provera: prijava, zakazivanje kao gost, chat, `/razvoj`. Ako nešto odjednom izgleda prazno ili baca grešku, obriši `RLS_ENFORCE` i uradi redeploy: sve se vraća kako je bilo (podaci se ne diraju).
Detalji i pravila za novi kod: `docs/ARCHITECTURE.md`, odeljak „Row Level Security”.

## 8. Domen
Kad se kupi mojfrizer.com: Vercel → Domains → dodaj `mojfrizer.com` i `*.mojfrizer.com` (poddomeni salona), pa postavi `APP_URL` i `ROOT_DOMAIN`.

## Rezervne kopije
Vraćanje baze na raniji trenutak i ručni izvoz: `docs/BACKUP.md`.

## Lokalna provera produkcijskog builda
`VERCEL=1 VERCEL_ENV=production SEED_OWNER_PASSWORD=... bash scripts/vercel-build.sh`

## Brzina (region baze i funkcija)
Najveći uzrok sporosti je razdaljina između Vercel funkcije i Neon baze: svaki upit plaća put tamo i nazad (preko okeana oko 80-100 ms), a stranica ima 5-20 upita. `vercel.json` drži funkcije u `fra1` (Frankfurt), pa Neon projekat mora biti u **AWS Europe (Frankfurt) `eu-central-1`**.
- Provera: Neon → Project → Settings → Region. Ako piše US East (N. Virginia), napravi novi projekat u Frankfurtu (Vercel → Storage → Neon), prenesi podatke (`pg_dump`/`pg_restore`) i zameni `DATABASE_URL` i `DATABASE_URL_UNPOOLED`.
- `DATABASE_URL` mora biti **pooled** adresa (u hostu piše `-pooler`); `DATABASE_URL_UNPOOLED` služi samo za migracije u build-u.
- Neon besplatni plan uspava bazu posle 5 min mirovanja; prvi klik posle pauze čeka ~0,5-1 s da se probudi. Plaćeni plan to može da isključi.
- Sa `RLS_ENFORCE=1` svaki upit ima 3 dodatna kruga ka bazi. U istom regionu to je zanemarivo (1-2 ms), preko okeana je to glavni razlog sporosti.
