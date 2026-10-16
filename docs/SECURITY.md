# SECURITY.md - Bezbednost aplikacije

Kratak pregled zaštita i pravila za novi kod. Tenant izolacija (RLS) je opisana u `ARCHITECTURE.md`, odeljak 5.

## Zaštita od zloupotrebe (brute force, spam, trošak)
- `src/lib/rateLimit.ts`: brojači u PostgreSQL tabeli `rate_limits` (važe za sve Vercel instance). Funkcije `consume` (broji i proverava), `isBlocked` + `recordHit` (samo neuspesi), `clearLimit`. IP dolazi iz `x-vercel-forwarded-for`.
- Prijava: 5 pogrešnih lozinki za isti nalog = čekanje 15 min uz poruku; 30 pokušaja po IP adresi na 10 min; nepostojeći nalog troši isto vreme kao pogrešna lozinka.
- Registracija 5/sat po IP, reset lozinke 5/15 min po IP i 3/sat po emailu (odgovor je uvek isti), honeypot polje `mf_hp` u `AuthForm`.
- Zakazivanje i hitni zahtevi: limit po IP i telefonu; najviše 5 aktivnih online termina i 3 otvorena hitna zahteva po osobi u salonu (`src/lib/bookingGuard.ts`).
- Chat, lista čekanja, upravljanje terminom, upload slike, slobodni termini, Google prijava imaju svoje limite.
- AI asistent: 20 pitanja/10 min i 100/dan po IP, dnevni limit za celu platformu (`ASSISTANT_DAILY_LIMIT`, podrazumevano 3000), provera `Origin`.
- Novi javni endpoint ili akcija koja šalje mejl, piše u bazu ili zove plaćeni servis MORA da ima `consume(...)`.

## Sesije i lozinke
- Kolačić `mf_session`: JWT (HS256), httpOnly, sameSite=lax, secure u produkciji, 7 dana. `getSessionUser()` svaki put čita nalog iz baze (uloga, postojanje) i odbija kolačiće izdate pre `User.sessionsValidAfter`. Posle promene ili reseta lozinke pozvati `revokeSessions(userId)`.
- Lozinke: bcrypt cost 12, najviše 72 znaka. Tokeni za reset/verifikaciju: 256 bita, čuva se samo hash, jednokratni, 1 h / 48 h.
- Google prijava: state + PKCE. Pri povezivanju sa postojećim nalogom čiji email nije potvrđen briše se lozinka (neko je mogao da registruje tuđu adresu).

## Zaglavlja
`next.config.ts`: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; `X-Powered-By` isključen. Nova spoljna adresa (skripta, slika, okvir) mora da se doda u CSP.

## Zavisnosti
CI pada na kritičnu ranjivost u produkcionim paketima (`npm audit --omit=dev --audit-level=critical`); Dependabot otvara PR-ove nedeljno. Poznato: `prisma` CLI (alat za migracije, ne radi na zahtevima korisnika) vuče `deepmerge-ts` sa ranjivošću; ispravka traži Prisma 7 (veliki skok), pa se radi kao posebna nadogradnja.

## Šta čeka vlasnika platforme (nije u kodu)
Vidi izveštaj u razgovoru: `RLS_ENFORCE=1`, rotacija `AUTH_SECRET`/`CRON_SECRET` ako su ikad bili u čatu, Vercel Deployment Protection za preview, Neon/Resend/Google podešavanja.
