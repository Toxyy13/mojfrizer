# CONVENTIONS.md - Kodni Standardi i Koraci u Radu

## 1. STIL PISANJA KODA
- **Jezik:** Sav kod, nazivi baza, tabela, funkcija, promenljivih i komponenti MORAJU biti na ENGLESKOM jeziku. Komentari u kodu moraju biti jasni i kratki.
- **Imenovanje:** 
  - `camelCase` za funkcije, rute i promenljive.
  - `PascalCase` za React komponente i TS tipove.
  - `SNAKE_CASE` za ENV promenljive i polja u bazi (ako je potrebno).
- **TypeScript:** Strogo kucanje. Upotreba `any` je strogo zabranjena. Svaka funkcija i komponenta mora imati jasno definisane tipove (`interface` ili `type`).
- **Asinhroni kod:** Koristi isključivo `async/await` sa `try/catch` blokovima.

## 2. REDOSLED RADA
Ne praviti celu aplikaciju odjednom, već korak po korak:
1. **Prvi korak:** Kompletan `schema.prisma` na osnovu `ARCHITECTURE.md`.
2. **Drugi korak:** Kreiraj Server Actions/API rute za logiku zakazivanja i proveru preklapanja termina.
3. **Treći korak:** Napravi čist backend servis za računanje pazara i analitiku.
4. **Četvrti korak:** Kreiraj frontend komponente prateći striktno `DESIGN.md`.

## Baza i tenant izolacija
- Svaka nova tabela dobija RLS i politike u istoj migraciji (vidi `docs/ARCHITECTURE.md`, odeljak „Row Level Security”); test `rls.test.ts` pada ako tabela nema uključen RLS.
- Kod koji u ime posetioca čita ili piše tuđe redove (tajni linkovi, zakazivanje, prijava, cron) koristi `systemDb` ili `runAsSystem`, i to tek posle provere ovlašćenja.

## API i greške
- JSON endpointi odgovaraju greškom samo preko `apiError(status, poruka?)` iz `src/lib/apiError.ts`: telo je `{ error, code }`, status je pravi (400 ulaz, 401 nije prijavljen, 403 zabranjeno, 404, 413, 415, 429 sa `Retry-After`, 500). Telo zahteva se čita sa `readJson` (loš JSON je 400, ne 500) i proverava zod-om.
- Klijentu nikad ne vraćati poruku izuzetka, SQL ni stack; samo `console.error` na serveru.
- Idempotentni su: odjava sa mejlova, brisanje slike, brisanje naloga (drugi poziv vraća čist odgovor), cron. Novi POST koji pravi podatke treba da bude siguran na dupli klik (unique ključ ili provera pre upisa).
- Stranice grešaka: `not-found.tsx` (404), `error.tsx` i `global-error.tsx` (500), `/zabranjeno` (403), `/previse-zahteva` (429); svi koriste `ErrorPanel`.

## Minimizacija podataka (pregled 2026-10-16)
Prikuplja se samo: ime, email (ili telefon za stare naloge), lozinka (hash), telefon samo kod zakazivanja bez naloga (salon mora da može da pozove) i opciono na profilu, napomena uz termin (opciono), razlog hitnog zahteva. Registracija traži samo ime, email, lozinku i potvrdu uslova; telefon i slika su opcioni. Ocene javno prikazuju samo ime. Brojač pokušaja prijave čuva IP i email samo dok traje prozor (do 2 dana).
