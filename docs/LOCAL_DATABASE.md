# Lokalna baza u Dockeru

Aplikacija koristi lokalni Supabase (PostgreSQL, Auth i REST API) kroz Docker Desktop. Nije potreban plaćeni Supabase server.

Pokreni Docker Desktop, pa:

```powershell
npm run db:local
npm start
```

API: http://127.0.0.1:54321. PostgreSQL: port 54322. Lokalni email sandučić: http://127.0.0.1:54324.

`db:local` čuva prethodni `.env.local` u ignorisanom `supabase/.temp` folderu i upisuje lokalni URL i javni ključ. Ne menja šemu ni podatke. Već pokrenutu aplikaciju treba restartovati; za build ponovo pokrenuti `npm run build`. Prijavi se postojećim emailom i lozinkom: podaci korisnika i hash lozinke preneti su sa servera, ali stara sesija nije važeća na lokalnom API-ju.

Prenos od 8.10.2026. koristi stvarnu šemu i podatke sa hosted projekta, uključujući njegovu istoriju migracija. Novije migracije iz repozitorijuma nisu automatski primenjene, da bi stanje ostalo isto kao na serveru. Ako kasnije želiš sve nove migracije, pokreni `npm run db:migrate:local` nakon kopije baze.

`npm run db:stop` zaustavlja kontejnere i čuva bazu. Nemoj koristiti `supabase db reset` ili brisati Docker volume ako želiš da sačuvaš podatke.

Kopije prenosa su u `supabase/.temp/hosted-schema.sql` i `hosted-data.sql`. Kopija prethodne lokalne baze je `paperwork-before-move.dump`. Ovi fajlovi sadrže privatne podatke i nisu u Gitu. Za novu kompletnu lokalnu kopiju:

```powershell
docker exec supabase_db_invoice-generator pg_dump -U postgres -d postgres -Fc -f /tmp/paperwork.dump
docker cp supabase_db_invoice-generator:/tmp/paperwork.dump supabase/.temp/paperwork-local.dump
```

Baza je dostupna na ovom računaru dok Docker radi. Hosted projekat nije obrisan ili izmenjen. Podešavanje lokalnog URL-a ne menja već objavljenu aplikaciju na internetu.
