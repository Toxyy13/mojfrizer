# CONVENTIONS.md - Kodni Standardi i Koraci u Radu

## 1. STIL PISANJA KODA
- **Jezik:** Sav kod, nazivi baza, tabela, funkcija, promenljivih i komponenti MORAJU biti na ENGLESKOM jeziku. Komentari u kodu moraju biti jasni i kratki.
- **Imenovanje:** 
  - `camelCase` za funkcije, rute i promenljive.
  - `PascalCase` za React komponente i TS tipove.
  - `SNAKE_CASE` za ENV promenljive i polja u bazi (ako je potrebno).
- **TypeScript:** Strogo kucanje. Upotreba `any` je strogo zabranjena. Svaka funkcija i komponenta mora imati jasno definisane tipove (`interface` ili `type`).
- **Asinhroni kod:** Koristi isključivo `async/await` sa `try/catch` blokovima.

## 2. FAZNI RAD (Kako da odgovaraš korisniku)
Nemoj generisati celu aplikaciju odjednom jer će kod biti polovičan. Radi uvek korak po korak:
1. **Prvi korak:** Generiši kompletan kod za `schema.prisma` na osnovu `ARCHITECTURE.md`.
2. **Drugi korak:** Kreiraj Server Actions/API rute za logiku zakazivanja i proveru preklapanja termina.
3. **Treći korak:** Napravi čist backend servis za računanje pazara i analitiku.
4. **Četvrti korak:** Kreiraj frontend komponente prateći striktno `DESIGN.md`.
