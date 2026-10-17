# Provera SQL obnove računovodstvene baze

Status: lokalna tehnička proba REL-05, trajne kopije izolovanih test baza i eksplicitno priloženi test fajlovi. Produkcijska/staging obnova i Storage/upload tok nisu potvrđeni. Browser JSON backup ne obuhvata računovodstvene tabele.

## Ponovljiva provera

Posle završenog build-a pokrenuti `npm run e2e:relational`. Runner pravi novu izolovanu bazu, proverava migracije i računovodstvene komande, zatim poziva `accounting-restore.test.py`, `accounting-backup.test.py` i `accounting-attachment-backup.test.py` iz `supabase/tests/`. Browser regresije rade na bazi obnovljenoj iz sačuvanog SQL/fajl paketa. Originalna lokalna baza i hosted projekat se ne migriraju ovim runner-om. Probe oporavka rade redom jer negativne provere upoređuju inventar test baza.

Za zasebno ponavljanje na već pripremljenoj test bazi sa svih sedamnaest računovodstvenih migracija i proknjiženim payment/FX/stock/opening primerima (SQL-only proba radi i na ranijim šemama):

```powershell
$env:RELATIONAL_TEST_DB='paperwork_relational_<broj_iz_prethodne_provere>'
python supabase/tests/accounting-restore.test.py
```

Zameniti ceo placeholder stvarnim nazivom iz prethodne provere. Skripta prihvata samo `paperwork_relational_` i cifre, koristi lokalni Docker kontejner `supabase_db_invoice-generator` i sama generiše nov, različit naziv odredišta. `createdb` odbija postojeće odredište; nema DROP, CLEAN niti upisa u izvornu bazu. Sve test baze ostaju za pregled. Ne unositi naziv stvarne poslovne baze.

## Trajna lokalna kopija — izolovane test baze

Za pripremljenu test bazu postoje tri komande:

```powershell
npm run db:backup:local -- --database 'paperwork_relational_<cifre>'
npm run db:backup:verify -- --backup '<generisani-ID>'
npm run db:backup:restore -- --backup '<generisani-ID>'
```

Placeholdere u primerima zameniti stvarnim nazivom pripremljene test baze i celim backup ID-jem iz izlaza kreiranja. ID je oblik `YYYYMMDDTHHMMSSZ-<32 hex cifre>`. Komande prihvataju samo lokalne test baze `paperwork_relational_<cifre>` i ID, nikada proizvoljnu putanju ili postojeće odredište obnove.

Kopija se čuva u ignorisanom workspace folderu `.accounting-backups/<ID>/`: `database.dump` je custom SQL archive, a `manifest.json` sadrži verziju, izvor, UTC vreme, restore politiku, dužinu/SHA-256 i otiske svih redova i metapodataka. Oba fajla se upisuju isključivo kao novi i fsync-uju. Folder se objavljuje tek kada su oba upisa završena; prekinut upis ostaje `.partial-*` i ne može se koristiti kao objavljena kopija. Postojeći backup ID se ne prepisuje. Fsync fajlova i objavljivanje foldera ne predstavljaju potvrdu oporavka nakon gubitka struje na svakom filesystem-u.

Verify iz novog procesa čita fajlove, proverava manifest, stvarnu dužinu, SHA-256 i PostgreSQL sadržaj/listu objekata. Restore koristi upravo te proverene bajtove; ne čita naknadno izmenjen archive. Neispravna kopija se odbija pre kreiranja baze. Obnova u novu, različitu bazu poredi podatke, sekvence i metadata sa manifestom; rezultat nije uspešan ako se razlikuju. `restores/<novi-ID>.json` čuva odredište, UTC početak/kraj, trajanje, archive otisak i status `verified`/`failed`. Neuspelo izvršavanje može ostaviti odvojenu bazu za pregled; nikada ne prepisuje postojeću bazu. Ako sam upis izveštaja ne uspe, komanda vraća grešku i nema potvrđenog izveštaja.

SHA-256 proverava integritet, ne autentičnost: izmena archive-a i njegovog manifesta od strane istog napadača nije digitalno potpisana kopija. Fajlovi nisu šifrovani; Windows pristup zavisi od lokalnih ACL pravila. CLI je ograničen na sintetičke lokalne test baze, nije operativni backup stvarnih poslovnih podataka. Nema automatskog brisanja, rasporeda, retention politike, udaljene kopije ili storage priloga. Artifact-i i Python cache nisu deo Git-a niti produkcijskog build-a.

## Prilozi uz SQL kopiju — eksplicitni test paket

Aplikacija ima registar spolja arhiviranih priloga kroz devetu migraciju `20261008190000_accounting_attachments.sql`; nema Storage upload. Izbor fajla u ekranu izračunava veličinu i SHA-256, zatim čuva samo metapodatke i korisnikovu oznaku spoljne arhive. Original nije otpremljen, niti registrovanje pravi njegov backup. Ovaj postupak proverava oporavak eksplicitno dostavljenih sintetičkih fajlova, ne otkriva automatski priloge niti čita Downloads ili `.env.local`. Ako tabela registra postoji, svaki dostavljeni fajl mora odgovarati registrovanom ID-ju, firmi, cilju, nazivu, veličini i kontrolnom zbiru pre kopije i posle obnove. Starije test baze bez devete migracije zadržavaju proveru firme/cilja. Povučeni zapisi i njihovi originali ostaju istorija; povlačenje ništa ne briše.

Ulaz je ignorisani workspace folder `.accounting-backup-inputs/<32 hex cifre>/` sa `index.json` i `files/<kanonski UUID>.bin`. Index ima tačno `version: 1` i `attachments` listu. Svaka stavka sadrži `id`, `firmId`, `targetType` (`document` ili `bank_statement`), `targetId`, `name`, `bytes` i `sha256`. ID-jevi su kanonski UUID-i, naziv je običan filename, veličina i SHA-256 moraju odgovarati stvarnom fajlu. Podržano je najviše 100 fajlova, 10 MiB po fajlu i 50 MiB ukupno. Dodatni/neprijavljeni fajl u `files/` odbija ceo paket.

```powershell
npm run db:backup:local -- --database 'paperwork_relational_<cifre>' --attachments '<32-hex-ulazni-ID>'
```

UUID iz `firmId` i cilj moraju zaista postojati u istoj test bazi i biti povezani u izvornoj tabeli dokumenata/izvoda. Nema vezivanja partnera/fajla po nazivu ili pretpostavci. Ulazne putanje i njihove stvarne lokacije se proveravaju; link/junction koji izmešta fajlove odbija se. Izvorni fajlovi se ne menjaju.

Nove kopije koriste manifest v2 sa obaveznom `attachments` listom, uključujući praznu listu kada prilozi nisu dostavljeni. SQL kopije v1 ostaju čitljive i prijavljuju 0 priloga. Kopija sadrži sopstvene proverene bajtove u `attachments/<UUID>.bin`, pa obnova ne zavisi od dostupnosti izvornog input foldera.

Verify proverava sve fajlove pre kreiranja baze. Restore prvo proverava SQL otiske, ponovo proverava veze firma/cilj u obnovljenoj bazi, upisuje odvojene fajlove, njihov `attachments.json` i ponovo proverava sadržaj pre objavljivanja foldera. Izveštaj uključuje `attachmentCount` i `attachmentDirectory` ispod `restores/`. Nazivi su metadata; fizička imena su UUID-i, nikada proizvoljne izvorne putanje. Postojeći poslovni folderi/baze nisu prepisani.

SQL i filesystem nisu jedna atomska transakcija. Greška u SQL/fajl koraku daje failed izveštaj i može ostaviti odvojenu test bazu ili `.partial-*` folder za pregled. Nema verified rezultata dok obe provere ne uspeju; nema automatskog brisanja postojećeg odredišta. Ovaj paket nije Storage bucket obnova, upload/ACL model aplikacije ili poslovna potvrda porekla dokumenta.

## Šta se proverava

Petnaesta migracija `20261009010000_accounting_fx_bank_posting.sql` dodaje pet relacija i bankarsku provenijenciju FX settlement-a. Dinamički inventory uključuje izvore, raspodele, naknade, storna i receipt-e. Brza obnova dodatno poredi bankarski radni snimak i ponavlja prvobitni source receipt bez novog knjiženja novca. Privremeni `generatedAt` FX snimka izuzima se samo iz poređenja dva časa čitanja; svi sačuvani podaci/metapodaci i istorijski datumi ostaju u proveri. [Ugovor bankarskog knjiženja](ACCOUNTING_FX_BANK_POSTING.md).

Četrnaesta migracija `20261009000000_accounting_fx_bank.sql` dodaje sedam relacija za devizne bankarske izvode i veze sa postojećim plaćanjima. Dinamički SQL inventory uključuje sve njihove redove, potvrde, FK/RLS/trigere i funkcije. Backup originalnog deviznog Excel fajla nije automatski: ovaj panel ne otprema fajlove i još nije povezan sa registrom priloga. Čuvanje tog fajla ostaje korisnikova arhiva. [Ugovor deviznih izvoda](ACCOUNTING_FX_BANK.md).

- Prava SQL kopija kroz `pg_dump --format=custom --no-owner` i obnova kroz `pg_restore --single-transaction --exit-on-error --no-owner`, bez ponovnog izvršavanja migracija u obnovljenoj bazi.
- SHA-256 otisci kanonskih redova svake public/auth tabele, broj redova i stanje sekvenci; obuhvaćeni su ledger, agencija, dokumenti, avansi, banka, raspodele, veze, audit i receipt-i.
- Kolone/default-i, FK/CHECK/unique ograničenja, indeksi, konfiguracija sekvenci, funkcije, privilegije, RLS/politike i neizmenjivi okidači. Poznata ekvivalentna PostgreSQL deparserska promena dva poznata BETWEEN/AND CHECK izraza normalizuje se samo za tačno definisane ekvivalentne oblike; ostale razlike zaustavljaju proveru.
- Autorizovano čitanje istog bankarskog radnog prostora i replay bankarskog knjiženja sa prvobitnim ključem; replay ne menja obnovljene redove. Nepovezan korisnik nema pristup, direktni klijentski DML je odbijen, a istorijska veza se ne menja ni privilegovanim UPDATE-om.
- Namerno skraćena kopija mora da padne bez delimičnih public/auth tabela. Završno poređenje potvrđuje da se izvor nije promenio.

Brza SQL proba koristi kopiju u memoriji; dodatna persistent proba koristi sačuvane fajlove iz odvojenih CLI procesa. Proveravaju se skraćen/izmenjen archive, nedostajući fajl, neispravan manifest/verzija/ID, nedovršen upis, postojeći ID i pogrešni očekivani otisci. Otisci i nazivi test baza mogu se zapisati u izlaz provere; sadržaj SQL kopije i redova se ne ispisuje.

## Šta ostaje za zatvaranje REL-05

Potrebna je proba u odvojenom stvarnom staging okruženju sa deklarisanim vlasništvom objekata/ulogama, potrebnim ekstenzijama, konfiguracijom Auth/REST i kontrolom sesija i tajni. Ova proba koristi postojeće uloge istog lokalnog PostgreSQL klastera i `--no-owner`; ne proverava obnavljanje klasterskih uloga niti hosted Auth konfiguracije. Browser test koristi lokalni Auth servis, ne pokreće novi obnovljeni Auth servis.

Eksplicitni sintetički prilozi i registar dokumentnih/bankarskih veza sada su uključeni u lokalnu probu. Stvarni originalni Excel, upload, Storage objekti/politike i eksterni dokazi još zahtevaju integraciju i proveru obnove u staging-u. Trenutni bankarski modul originalni Excel zadržava kod korisnika. Potrebni su operativne kopije, politika čuvanja/pristupa, merena vremena gubitka i oporavka i operativna potvrda. Tek cela proba ispunjava REL-05; lokalni SQL/fajl test sam ne zatvara zadatak niti odobrava samostalnu produkcijsku upotrebu.

Sedamnaesta migracija `20261009110000_accounting_opening.sql` dodaje šest relacija za početne izvore, mapirana salda, pojedinačne otvorene stavke, storna, veze sa postojećim plaćanjima i receipt-e. Izvorni redosled stavki čuva se relacijski radi istog request hash-a nakon obnove. Brza obnova poredi ceo opening snapshot i ponavlja originalni uvoz bez novih redova/naloga; sve tri probe porede i funkcije/prava/RLS/trigere. Originalni Excel fajl nije automatski otpremljen; čuvanje njegovog SHA ne zamenjuje arhivu fajla. [Ugovor početnog uvoza](ACCOUNTING_OPENING.md).
