# Devizni Excel izvodi i povezivanje plaćanja

Aktuelni blok završava 3 tehničke celine: deklarisani devizni Excel uvoz, povezivanje već potvrđenog plaćanja bez novog naloga i kontrolu salda pojedinačnog izvoda sa nepovezanim transakcijama. Napredak ostaje 14/32 glavna zadatka završeno, 18 preostalo. FX-01 je IN_PROGRESS: poslovno usaglašavanje i zavisnosti ostaju otvoreni. Sledeći blok cilja 3 povezane celine: knjiženje iz uvezenog reda, raspodelu na više deviznih stavki i obradu naknade/neraspoređenog ostatka. To je ciljani obim sledećeg bloka, ne potvrda da je ceo FX modul završen.

Četrnaesta opciona migracija je `20261009000000_accounting_fx_bank.sql`. Prethodnih trinaest migracija ostaju nepromenjene. Sedam novih neizmenjivih relacijskih tabela čuva račune, izvode, transakcije, redove izvoda, potvrde komandi i veze sa postojećim plaćanjima. Firm-scoped FK, RLS, serverske dozvole, zaključavanje firme, audit i receipt/hash replay važe i za ovaj modul. Nema direktnog klijentskog DML-a. SQL kopija obuhvata sve nove relacije i funkcije; original Excel fajl ostaje u korisnikovoj arhivi.

Ovaj dokument opisuje obim četrnaeste migracije. Petnaesta migracija dodaje [knjiženje bankarskog izvora, više raspodela i izlazne naknade](ACCOUNTING_FX_BANK_POSTING.md); postojeći ručni tok povezivanja ostaje podržan. Njene nove mogućnosti zamenjuju odgovarajuće ranije otvorene stavke u granicama ispod.

## Format i iznosi

Jedan račun ima jednu valutu EUR/USD/CHF/GBP i eksplicitno izabrano RSD konto novca. Broj računa se normalizuje uklanjanjem razmaka/crtica i velikim slovima; dozvoljeno je 5–64 slova/cifara. To nije provera IBAN-a niti dokaz da dve različite bankarske oznake predstavljaju isti račun. Isti broj ne može biti istovremeno registrovan kao RSD račun iste firme. Bankarski ID je case-sensitive tekst do 100 znakova; aplikacija ne generiše zamenski ID.

Excel šablon ima osam kolona: `transaction_id`, `booking_date`, `value_date`, `incoming_foreign`, `outgoing_foreign`, `counterparty`, `reference`, `description`. Prihvataju se i srpski nazivi iz šablona. Jedan vidljiv list, do 2000 redova/5 MB; skrivene redove, formule, numeričke ID/iznos ćelije, dodatne kolone, ugrađene prazne redove i duple ID-jeve odbija ceo fajl. Datumi su ISO/dd.mm.yyyy tekst ili Excel datum na ponoć UTC. Iznosi su tekst sa do dve decimale, bez eksponenta i separatora hiljada; jedan pozitivan priliv ili odliv po redu. Kanonski iznos u najmanjoj jedinici ima do 24 cifre; BigInt/NUMERIC čuvaju tačnost. RSD i devizni šabloni su odvojeni.

Zaglavlje na ekranu određuje račun, referencu, godinu, datume i početno/završno devizno stanje. Valuta dolazi iz registrovanog računa, ne iz nagađanja sadržaja fajla. Server proverava datume unutar godine i `početno + zbir priliva − zbir odliva = završno`. Zbirovi priliva/odliva moraju stati u 24 cifre. Pogrešna računica odbija ceo zahtev, uključujući sve redove i receipt.

Isti račun/godina/referenca i potpuno isti sadržaj predstavljaju ponovljen izvod, čak i posle preimenovanja fajla ili promene redosleda redova; sadržaj se poredi po bankarskom ID-ju. Ista referenca sa izmenjenim sadržajem se odbija. Različiti izvodi sa preklopljenim datumima istog računa se odbijaju. ID transakcije je trajan po firmi/računu; promena sadržaja istog ID-ja odbija zahtev. Ovo namerno ograničava alternativne zbirne/dnevne izvoze; korekcija izvoda i prozori koji se preklapaju traže poseban adapter/protokol.

## Povezivanje postojećeg naloga

Uvoz ne knjiži konto novca, ne menja deviznu glavnicu i ne označava dokument plaćenim. Korisnik u panelu monetarnih stavki potvrđuje ručno plaćanje sa kursom/dokazom, pa osvežava izvod. Sistem nudi samo postojeće plaćanje koje tačno odgovara firmi, normalizovanom računu, bankarskom ID-ju, valuti, iznosu, smeru, datumu knjiženja i izabranom kontu novca. Potraživanje traži priliv; obaveza odliv. Datum valute ostaje dokaz i ne zamenjuje datum knjiženja. Fuzzy pretraga po imenu partnera ne pravi veze.

Provera važi u oba redosleda: ako postoji plaćanje, konfliktni uvoz se potpuno odbija; ako izvod postoji prvi, konfliktno ručno plaćanje se potpuno odbija zajedno sa nalogom i receipt-om. Registrovani devizni račun ograničava valutu/konto ručnog plaćanja čak i pre uvoza konkretnog ID-ja.

`paperwork_link_fx_bank_payment` samo registruje neizmenjivu vezu postojećeg reda i postojećeg settlement-a, bez novog naloga ili promene FX revizije. Jedna transakcija ima najviše jednu vezu; jedno plaćanje najviše jednu transakciju. Aktivno plaćanje je obavezno pri prvom povezivanju. Ponavljanje prvobitnog zahteva vraća isti receipt, uključujući nakon kasnijeg storna. Povučena dozvola blokira i replay. Dva konkurentna povezivanja imaju jednog pobednika.

Storno ostaje kroz FX panel, po poslednjem aktivnom događaju i otvorenom periodu. Istorijska bankarska veza ostaje sačuvana, a čitanje označava plaćanje kao stornirano i vraća transakciju u nepovezani iznos. Storno ne briše bankarski događaj. Stornirani bankarski ID ne može da se zameni novim settlement-om; ne koristiti veštački novi ID da se zaobiđe zaštita.

Nepoznat odgovor čuva prvobitni payload/ključ. Ekran blokira izmene, druge module i promenu konteksta do ponavljanja istog zahteva. Prikaz jednog izvoda, kandidata i statusa veza dolazi iz jednog serverskog snimka. Pregled godine ne skraćuje tiho listu: više od 500 izvoda odbija pregled.

## Kontrola i granice

Kontrola proverava deviznu računicu pojedinačnog izvoda i prikazuje broj/iznose nepovezanih priliva i odliva. Potvrđeno plaćanje bez registrovane veze, nedostajući nalog i stornirano plaćanje računaju se kao nepovezani. Računica izvoda može biti ispravna dok svi redovi čekaju povezivanje; ekran prikazuje obe informacije.

To ne potvrđuje početno stanje, kontinuitet svih izvoda, autentičnost bankarskog dokaza, RSD saldo glavne knjige ili bankarsku deviznu glavnicu/vrednovanje. Naknade, preplate, povraćaji, više monetarnih stavki za jednu transakciju, automatsko knjiženje iz uvezenog reda i zamena storniranog ID-ja ostaju otvoreni. Banka još nije identifikovana; podržan je deklarisani šablon, ne svaki izvorni bankarski Excel raspored. Upload/Storage, devizni računi/avansi/aging, regulatorni moduli i poslovne kontrolne tačke ostaju zasebni zadaci.

## Referentne provere

| Primer | Očekivanje |
| --- | --- |
| Izvod 100 EUR početno, priliv 40 EUR, završno 140 EUR | Tačan uvoz bez naloga; nepovezano 40 EUR do registracije veze |
| Postojeće plaćanje 40 EUR, bankarski red 41 EUR sa validnim saldom | Ceo uvoz odbijen; ništa delimično sačuvano |
| Prvo izvod, zatim ručno plaćanje pogrešnog iznosa/smera/datuma/valute/konta | Plaćanje, nalog i receipt odbijeni zajedno |
| Tačno podudaran postojeći settlement | Povezivanje sa potvrdom; broj naloga se ne menja |
| Storno povezanog plaćanja | Veza ostaje; nepovezani iznos ponovo prikazan; istorijski receipt se ponavlja |
| Excel iznos `9007199254740993.01`, početno −0,01 | Tačno `900719925474099301` najmanjih jedinica, završno `900719925474099300` |
| Formula/numerički iznos, dupli ID, nesaglasan saldo, preklapanje | Odbijen ceo fajl/zahtev |
| Dva istovremena povezivanja ili izgubljen odgovor nakon upisa | Jedna veza; replay istog ključa bez duplog naloga |
| Čitalac ili opozvan agencijski pristup | Pregled prema dozvoli; bez mutacije i bez podataka druge firme |

Automatska provera sintetičkih primera ne zamenjuje poslovnu potvrdu knjigovođe.

## Rezultat lokalne validacije

51 Jest grupa / 305 testova, TypeScript i završni build prolaze. Sve legacy i 14 računovodstvenih SQL provera prolaze na izolovanoj bazi `paperwork_relational_1791464953`. Tri Python provere potvrđuju usku ekvivalentnost poznatih PostgreSQL CHECK zapisa i razlikovanje stvarnih promena uslova.

Posle ispravke poređenja PostgreSQL deparserskih oblika, SQL obnova svih 107 tabela/sekvenci i metapodataka, trajni backup i paket test priloga prolaze. Obnova dodatno proverava isti FX bankarski snimak i replay prvobitnog link receipt-a bez mutacije. Završni browser skup prolazi nad `paperwork_relational_1791465487787731600`: legacy/restore, 12 RLS provera, sharing i kompletan accounting tok sa stvarnim deviznim Excel uvozom, povezivanjem bez duplog naloga i istim zahtevom nakon izgubljenog odgovora.

Produkcija i originalna poslovna baza nisu migrirane. Udaljeni CI nije izvršen; ove provere su lokalne i sintetičke. Detaljni trag je u [devetnaestoj implementacionoj celini](ACCOUNTING_BACKLOG.md#devetnaesta-implementaciona-celina--devizni-excel-izvodi-i-postojeća-plaćanja).
