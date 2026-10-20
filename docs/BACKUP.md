# Rezervne kopije baze (Neon)

## Šta Neon već radi sam
Neon čuva istoriju promena baze (point-in-time restore, PITR) pa se baza može vratiti na bilo koji trenutak u prošlosti. Besplatni plan čuva kratku istoriju (oko 6 sati, vrednost se menja, proveri u Neon → Settings → Storage / Restore window), plaćeni plan duže (do 7-30 dana). Zato **pre većih promena ili nedeljno napravi ručni izvoz** (dole).

## Vraćanje na raniji trenutak (kada se nešto obriše ili pokvari)
1. console.neon.tech → projekat → **Backup & Restore** (ili Branches → Restore).
2. Izaberi granu `main` (production), pa **Restore to a point in time** i vreme *pre* greške.
3. Preporuka: ostavi uključeno čuvanje stare verzije (backup grana „main (old)”), pa ako pogrešiš vreme možeš opet.
4. Posle vraćanja proveri sajt. `DATABASE_URL` se ne menja, nema novog deploy-a.
Bezbednije: umesto direktnog vraćanja napravi novu granu iz željenog trenutka (Branches → Create branch → From past data), proveri podatke u SQL Editor-u, pa prekopiraj šta ti treba.

## Ručni izvoz (svaka nedelja ili pre migracije)
Treba PostgreSQL klijent (`pg_dump`, verzija 16 ili novija; na Windows-u instalacija „PostgreSQL” samo sa Command Line Tools).
1. Neon → Connect → izaberi **Direct connection** (bez `-pooler` u adresi) i kopiraj adresu.
2. U terminalu u folderu projekta:
   ```
   DATABASE_URL_UNPOOLED="postgresql://..." bash scripts/backup.sh
   ```
   (PowerShell: `$env:DATABASE_URL_UNPOOLED="postgresql://..."; bash scripts/backup.sh`)
3. Nastaje `backups/mojfrizer-<datum>.dump` (folder je u `.gitignore`). Fajl sadrži lične podatke mušterija: čuvaj ga privatno (lični disk, ne GitHub, ne mejl).

## Vraćanje iz izvoza
U **praznu** bazu (nova Neon grana ili projekat), ne preko žive:
```
pg_restore --no-owner --no-privileges --dbname "postgresql://NOVA_BAZA" backups/mojfrizer-<datum>.dump
```
Pa u Vercel-u zameni `DATABASE_URL` i `DATABASE_URL_UNPOOLED` novom bazom i uradi redeploy.

## Provera da kopija radi
Jednom mesečno vrati poslednji izvoz u novu Neon granu i otvori tabelu `Salon`. Kopija koja nikad nije probana nije kopija.
