# Plan razvoja knjigovodstvenog sistema

Datum ažuriranja: 11. oktobar 2026.
Status: projektni plan sa delimičnom implementacijom.
Aktuelni status se vodi u [pregledu isporuke i svih ranije otvorenih zadataka](ACCOUNTING_DELIVERY_STATUS.md). Implementacija: **21/32 završeno u deklarisanom obimu, 11 preostalo za razvoj**. Po prvobitnim kompletnim kriterijumima: 14/32; sedam implementiranih zadataka čeka poslovne potvrde/zavisnosti. Nova isporuka je [interni deo TAX-02](ACCOUNTING_TAX_EVIDENCE.md): trajni datirani profili, poreski događaji, kontrola perioda i stvarni Excel izvoz. TAX-02 ostaje delimičan jer regulatorni izvoz, datirani avansi/korekcije i preostali scenariji odbitka/kontrole perioda sa više režima nisu završeni. Sledeći blok nastavlja te tri povezane celine; SEF je posle TAX-02. Dokazi su u [backlogu](ACCOUNTING_BACKLOG.md).
Cilj potvrđen sa korisnikom: knjigovođa koji vodi više firmi u Srbiji, uključujući DOO.
Poslednji blok završava prospektivnu promenu korišćenog PDV profila: trajni završetak, naslednik bez preklapanja i istorija u prikazu/Excelu. Sledeći blok cilja tri povezane isporuke za odbitak u kasnijem periodu: relacione odluke i ograničenje iznosa, kontrolu datuma/perioda i UI/Excel sa istorijom. Avansi/korekcije i regulatorni format ostaju otvoreni u TAX-02; promena usred poreskog perioda još blokira izvoz.

[Knjiženje i raspodela deviznog bankarskog reda](ACCOUNTING_FX_BANK_POSTING.md). Raniji [Excel uvoz i postojeće veze](ACCOUNTING_FX_BANK.md) ostaju podržani.

[Zalihe, prosečna vrednost, kartice i knjiženja](ACCOUNTING_INVENTORY.md).

[Početni Excel uvoz, mapiranja, otvorene stavke i usaglašavanje](ACCOUNTING_OPENING.md).

## 1. Cilj i granice

Paperwork razvijamo u sistem za rad knjigovodstvene agencije: dokumenti, odobravanje, dvojno knjiženje, analitike, usaglašavanje i zatvaranje perioda. Fakturisanje i KPO ostaju posebni moduli. KPO nije glavna knjiga DOO. CV/ATS funkcije ostaju dostupne tokom prelaska, ali izdvojene iz poslovnog radnog prostora; ne brišemo njihove podatke.

Prvi pilot: uslužne firme, RSD i devizno poslovanje, ulazni/izlazni računi, banka, ručna knjiženja, početna stanja, glavna knjiga, bruto bilans i analitike partnera. Pilot je namenjen paralelnom radu sa postojećim knjigovodstvenim sistemom. Pre samostalne produkcijske upotrebe moraju proći i regulatorni moduli, zaštita podataka i poslovna validacija.

Kompletan sistem uključuje PDV i SEF, osnovna sredstva, obračun zarada, zalihe, godišnje zatvaranje i finansijske izveštaje. Svaki modul ima zasebnu kontrolnu tačku; ne prikazivati ga kao završen zato što postoji ekran. Budžetsko računovodstvo, banke, osiguranje, proizvodnja i konsolidacija nisu deo prve verzije.

Dve nedelje su okvir prve razvojne iteracije, ne obećanje završetka kompletnog sistema. Tempo sledećih iteracija procenjuje se tek kada postoje rezultati prve i potvrđeni poslovni primeri. Razvoj se izvršava u aktivnim radnim sesijama; ovaj dokument nije raspored autonomnog rada u pozadini.

## 2. Stanje pregledanog projekta

| Oblast | Postoji | Potrebna promena |
| --- | --- | --- |
| Firme i pristup | Više firmi, owner/accountant/viewer, RLS | Agencija, dodela operatera, odobravanje, detaljnije dozvole |
| Baza | Relacione tabele i transakcioni dokumentni RPC | Komande po poslovnoj radnji i revizije po entitetu |
| Fakture | Izlazne, stavke, snimak partnera, status | Odvojiti izdavanje, dostavu, naplatu i knjiženje; ulazni dokumenti |
| Naplata | paid/paidAt i uvoz izvoda | Plaćanja i raspodele, delimična naplata, avansi, preplate |
| Evidencije | KPO i pregled paušala | Kontni plan, dnevnik, glavna knjiga, bruto bilans |
| Audit | Klijentski, sabijanje izmena, najviše 3000 zapisa | Serverom potvrđen, neizmenjiv trag poslovnih radnji |
| Sinhronizacija | Revizije i odbijanje zastarelog upisa | Sačuvati neposlate izmene kada se pojavi novija serverska verzija |
| Backup | JSON, IndexedDB, opciona fascikla | Vidljiv neuspeh, validacija verzije, server backup i provereno vraćanje |
| CI | TypeScript, unit testovi, build, smoke | Izolovana baza, migracije, RLS i konkurentna knjiženja |

Početna provera: `npm run typecheck` prošao; 21 test suite i 126 testova prošlo. Test prijave emituje React `act` upozorenje. To nije potvrda regulatorne ispravnosti ni provera produkcijske baze.

## 3. Poslovni prostor i navigacija

- Agencija: sve dodeljene firme, odgovorni knjigovođa, dokumenti na čekanju, rokovi, nerešene razlike i stanje zatvaranja perioda. Rokovi imaju izvor i pravilo; ne izmišljati automatski obavezu na osnovu pravne forme.
- Firma: u zaglavlju uvek naziv, PIB, poslovna godina i otvoreni period. Promena firme ne prenosi forme, pretragu ili selekciju dokumenata druge firme.
- Dokumenti: izlazni, ulazni, avansi, korektivni dokumenti, prilozi i status obrade.
- Knjigovodstvo: kontni plan, nalozi, dnevnik, glavna knjiga, bruto bilans, otvaranje i zatvaranje.
- Partneri: kupci/dobavljači, kartice, otvorene stavke i usaglašavanje.
- Novac: računi, izvodi, raspodela uplata/isplata i razlike.
- Porezi i integracije: PDV, SEF i izvozi; vidi se šta je pripremljeno, potvrđeno, poslato i prihvaćeno.
- Operacije: osnovna sredstva, zarade i zalihe kada odgovarajući modul prođe kontrolu.
- Podešavanja: firma, poreski režim sa datumom važenja, uloge, numeracija, integracije i arhiva.

Početni ekran knjigovođe prikazuje posao koji treba završiti, sa vezom ka dokumentu ili razlici. Dobit dolazi iz potvrđenih knjiženja; tok gotovine iz novčanih događaja; KPO promet ostaje zaseban pokazatelj. Ne nazivati naplaćene fakture minus paušalni porez dobiti DOO.

## 4. Pravila koja baza mora da garantuje

1. Svaki poslovni red pripada firmi. Složeni strani ključevi sprečavaju povezivanje partnera, konta, dokumenta i naloga različitih firmi, čak i za korisnika koji sme da vidi obe.
2. Knjiženje je transakcija: nalog, sve stavke, izvorna veza i audit nastaju zajedno. Delimično knjižen nalog nije dozvoljen.
3. Potvrđen nalog ima najmanje dve stavke, zbir duguje jednak zbiru potražuje u osnovnoj valuti, validna konta i otvoren period. Svaka stavka ima iznos na jednoj strani; nema NaN, beskonačnosti ili neodređenog zaokruživanja.
4. Potvrđeni nalozi i njihovi iznosi se ne menjaju i ne brišu. Ispravka je novi povezani korektivni/storno nalog, sa razlogom, identitetom i vremenom. Usvojiti jednu politiku crvenog ili obrnutog storna sa knjigovođom i testirati njen uticaj na promet; ne mešati politike.
5. Zaključan period blokira izmene, knjiženja i pomeranje datuma koja bi ga zaobišla. Ponovno otvaranje je posebna dozvoljena radnja sa razlogom i auditom.
6. Ponovljen zahtev ili bankarski/SEF događaj ne pravi dupli dokument ili nalog: jedinstveni idempotency ključ, izvorna referenca i provereno ponavljanje odgovora.
7. Numeraciju izdavanja/knjiženja dodeljuje server pod konkurentnim opterećenjem. Jedinstvenost je po firmi, godini i seriji; broj se ne reciklira posle storna. Rupe imaju objašnjiv trag, ne lažnu garanciju da ne postoje.
8. Autor, potvrđivač i vreme dolaze iz serverske sesije i servera. Članstvo i poslovna dozvola proveravaju se pri svakoj komandi, ne samo u React formi.
9. Izdate dokumente štititi poslovnim pravilima baze. PDF izvoz, slanje emaila, izdavanje i knjiženje su zasebne radnje. Preuzimanje PDF-a samo po sebi ne potvrđuje slanje.
10. Neuspešno čuvanje ostaje vidljivo. Serverska revizija ne sme tiho odbaciti neposlate korisničke izmene. Odjava/promena naloga čisti prikaz i izoluje oporavljive nacrte po korisniku i firmi.

## 5. Arhitektura

Zadržati React/TypeScript i Supabase/PostgreSQL. Modularni monolit, bez mikroservisa u prvoj verziji. Dodatne tehnologije uvoditi samo uz konkretan razlog i proverenu kompatibilnost. Modernizacija build alata je zaseban zadatak posle stabilne početne provere, a ne istovremena promena celog proizvoda.

Tri sloja:

- Domen: iznosi, dokumenti, dozvoljeni prelazi, pravila knjiženja, politike kursa i perioda. Bez Reacta, browser skladišta i HTTP poziva.
- Aplikacioni sloj: eksplicitne komande `issueDocument`, `postJournal`, `reverseJournal`, `allocatePayment`, `closePeriod`; validacija, autorizacija i verzionisanje. UI ne sklapa direktno knjiženja.
- Infrastruktura: PostgreSQL transakcije/RPC, RLS, skladište priloga, serverske integracije i red poslova. React prikazuje stanje i šalje komande sa očekivanom revizijom i idempotency ključem.

Predložena struktura, uvoditi postepeno:

```text
src/domain/accounting/       novac, nalozi, periodi, pravila
src/domain/documents/        dokumenti, poreske kategorije, prelazi
src/application/             komande, upiti, ugovori repozitorijuma
src/infrastructure/          Supabase adapteri i transport
src/features/accounting/     ekran kontnog plana i knjiženja
src/features/purchases/      ulazni dokumenti
src/features/payments/       izvodi i raspodele
src/features/reports/        glavna knjiga i usaglašavanja
server/                     integracioni adapteri i pozadinski poslovi
supabase/migrations/         samo nove, verzionisane migracije
supabase/tests/              izolovana baza i poslovne garancije
```

Postojeće module ne premeštati masovno pre definisanja ugovora. Novi server direktorijum je predlog, nije postojeći deploy servis. Pre integracija izabrati konkretan runtime, upravljanje tajnama i nadzor poslova.

Browser u sistemu agencije nije autoritet za knjiženja. Offline dozvoliti pregled i jasno označene nacrte; izdavanje, potvrda i zatvaranje zahtevaju potvrdu servera. Ne uvoditi paralelnu lokalnu glavnu knjigu.

## 6. Model podataka

Ovo su logički entiteti, ne SQL koji treba odmah primeniti na produkciju.

| Grupa | Entiteti i važne veze |
| --- | --- |
| Organizacija | agencies, agency_members, agency_firm_assignments; postojeće firme i članstva |
| Firma | fiscal_years, accounting_periods, effective_tax_settings, numbering_sequences |
| Konta | account_templates, firm_accounts; sintetička/analitička konta, verzija šablona |
| Partneri | partners, partner_bank_accounts; partnerski identitet i snimak na dokumentu |
| Dokumenti | documents, document_lines, document_tax_lines, document_links, attachments |
| Knjiženja | journal_entries, journal_lines, posting_source_links, reversal_links |
| Novac | bank_accounts, bank_statements, bank_transactions, payments, payment_allocations |
| Kontrola | server_audit_events, operation_receipts, integration_jobs, import_batches |
| Regulatorni moduli | tax_periods, tax_calculations, sef_documents, integration_events |
| Kasnije | fixed_assets/depreciation, payroll_runs, inventory_movements |

Agencija dobija pristup firmi kroz eksplicitnu dodelu; članstvo u agenciji ne otvara automatski sve firme. Migracija ne prenosi vlasništvo postojećih firmi na novu agenciju. Vlasnik, operater, potvrđivač i čitalac su poslovne dozvole; postojeći accountant ne dobija automatski sva nova prava. Administrator infrastrukture nije poslovni potvrđivač.

Novac: potvrđene iznose čuvati kao celobrojne najmanje jedinice ili strogo ograničen PostgreSQL decimalni tip sa preciznim transportom. Za količine, cene i kurseve koristiti decimalnu aritmetiku sa definisanom preciznošću. U JavaScript ne pretvarati velike BIGINT iznose u nebezbedne Number vrednosti. Pravilo zaokruživanja dokumentovati i primenjivati isto na serveru, eksportu i ekranu.

Devizna stavka pamti originalnu valutu/iznos, osnovni iznos u RSD, kurs, datum, izvor i politiku konverzije. Istorijska knjiženja se ne preračunavaju po današnjem kursu. Kursne razlike nastaju kao zasebna knjiženja. Poreska i računovodstvena primena kursa se verifikuju zasebno.

Statusi su odvojeni: dokument (nacrt/izdat/korekcija), odobravanje, dostava/SEF, knjiženje i plaćanje. `paid` nije ručni prekidač za novi model: stanje nastaje iz potvrđenih raspodela. Jedno plaćanje može pokriti više dokumenata i obrnuto; podržati avans, preplatu, povraćaj i poništavanje raspodele bez brisanja traga.

Izveštaji se računaju iz potvrđenih stavki. Sačuvani snimci i materijalizovani pregledi moraju imati datum, reviziju i mogućnost ponovnog obračuna. Svaki zbir omogućava ulazak u stavke i originalni dokument. Bruto bilans uključuje početna stanja, promet i saldo po periodu; glavna knjiga i analitike moraju se usaglasiti.

## 7. Bezbedan prelazak postojećih podataka

1. Popis podataka i migracija u odvojenom okruženju: firme, članstva, dokumenti, KPO, potpisi, prilozi, audit i revizije. Ne čitati privatne backup fajlove iz Downloads bez potrebe za konkretnom migracijom.
2. Potvrđen backup baze i fajlova; uspešno vraćanje u izolovanu bazu. Lokalni JSON nije zamena za backup servera.
3. Nove tabele dodavati uz stare. Objavljene migracije ne prepisivati. Odrediti kanonski izvor šeme: postojeći generator i nova SQL šema ne smeju praviti različite ugovore.
4. Mapirati stare klijente u partnere sa poreklom i tabelom mapiranja. Sačuvati identifikatore, članstva i snimke izdatih dokumenata. Ne spajati partnere samo po imenu.
5. Probni uvoz: pregled razlika, duplikata, nepoznatih valuta, datuma, statusa i nepotpunih dokumenata. Nepodržani backup se odbija pre upisa. Povratak označava tačnu ciljnu firmu i nije svakodnevna zamena glavne knjige.
6. Stari `paid` ne proizvodi automatski izmišljenu bankarsku transakciju; predstavlja nasleđenu informaciju za usaglašavanje. KPO ne pretvarati u dvojna knjiženja bez kontiranja.
7. Izabrati početak vođenja glavne knjige: potvrđena početna stanja i otvorene stavke na datum prelaska ili kontrolisani istorijski uvoz. Ne knjižiti sve stare fakture preko početnih stanja, jer bi to dupliralo promet.
8. Izveštaj migracije poredi broj redova, iznose po valuti, otvorene stavke i vezane priloge. Knjigovođa potvrđuje kontiranje i početna stanja.
9. Jedna firma u pilotu, paralelno praćenje, zatim postepeno ostale. Aktiviranje po firmi preko feature flag-a; legacy modul ostaje dostupan za pregled tokom prelaska.
10. Pre aktivacije definisati povratak na staru verziju. Posle novih knjiženja povratak ne sme obrisati ta knjiženja: očuvati bazu i trag, zaustaviti komande, izvršiti popravku ili kontrolisan povratak.

Firma sa knjiženjima se arhivira. Postojeće kaskadno/permanentno brisanje ne sme biti dostupno za novu poslovnu evidenciju. Politiku čuvanja i brisanja usvojiti po vrsti dokumenta i relevantnim propisima.

## 8. Faze i kriterijumi završetka

| Faza | Isporuka | Uslov završetka |
| --- | --- | --- |
| P0 Pouzdanost | Oporavak konflikta, backup status, validacija uvoza, izolovani DB CI | Nema tihog gubitka; demonstrirano vraćanje; regresije zelene |
| P1 Jezgro | Godine/periodi, konta, nalozi, potvrda, storno, server audit | Baza odbija svaki neispravan i nedozvoljen nalog |
| P2 Dokumenti i partneri | Ulazni/izlazni, korekcije, početna stanja, kontiranje | Jedan dokument ne pravi dvostruko knjiženje; kontrolisan istorijski uvoz |
| P3 Novac i analitike | Banka, raspodele, otvorene stavke, devize | Delimične naplate i dupli izvodi rade; analitike se slažu sa knjigom |
| P4 Izveštaji i zatvaranje | Dnevnik, glavna knjiga, bruto bilans, zaključavanje | Reproduktivni izveštaji i usaglašeni zbirni/analitički saldi |
| P5 PDV i SEF | Verzije poreskih pravila, priprema/odobravanje, integracija | Poslovno provereni primeri i demo SEF; oporavak ne pravi duplu fakturu |
| P6 Potpuna pokrivenost | Sredstva, zarade, zalihe, godišnji izveštaji | Svaki modul ima potvrđene primere, kontiranje i važeće izvoze |
| P7 Produkcija | Pilot, nadzor, obnova, operativna uputstva | Zadovoljeni tehnički, poslovni i regulatorni uslovi za podržane firme |

Predložena prva iteracija od deset radnih dana: dani 1–2 P0 i ugovori jezgra; dani 3–5 izolovana šema/komande i testovi P1; dani 6–8 minimalni ekran konta/naloga i izveštaji; dani 9–10 konkurentnost, probna početna stanja i demonstracija pilot toka. To je procena kapaciteta i redosleda, ne obavezan rok. Ako P0 ili šema ne prođu, preostali posao se pomera, a kriterijumi se ne ublažavaju.

## 9. Provera kvaliteta

Obavezni skup proverava ponašanje sistema, ne samo identičnost sa implementacijom:

- neuravnotežen nalog; nepostojeće/neaktivno konto; nedozvoljen period; konto ili partner druge firme;
- direktan API pokušaj izmene/brisanja potvrđenih stavki, zaobilaženje autorizacije i pristup posle ukidanja članstva;
- istovremeno knjiženje istog izvora, paralelna numeracija i trka knjiženja sa zatvaranjem perioda;
- dvostruki klik, timeout posle commit-a, ponovljen zahtev i nastavak posle prekida veze;
- ulazni račun → odobravanje → knjiženje → delimično plaćanje → zatvaranje → korekcija;
- izlazna devizna faktura → više uplata → kursna razlika → usaglašena kartica;
- početna stanja sa otvorenim stavkama bez dupliranja istorijskog prometa;
- bruto bilans: ukupno duguje = ukupno potražuje; analitike = kontrolna konta; izvoz = ekran;
- dve nepovezane agencije, firma deljena eksplicitno, više operatera i čitalac;
- migracija kopije postojeće baze, neispravan backup bez delimičnog upisa, obnova baze i priloga;
- pretraga/izveštaji na reprezentativnim obimima; cilj odziva definisati i izmeriti pre pilota.

Razdvojiti razvoj, staging i produkciju sa zasebnim bazama i tajnama. CI ne koristi produkcijski service-role ključ ni korisničke dokumente. Postaviti migracioni posao i kontrolu kompatibilnosti verzije aplikacije sa šemom. Alarmirati neuspele poslove, backup i greške komandi uz request ID; logovi ne otkrivaju API ključeve ili nepotrebne lične podatke. RPO/RTO i period čuvanja definišu se pre pilota i proveravaju obnovom.

## 10. Regulatorni rad i integracije

Izvori pregledani 7. oktobra 2026. su početna referenca, ne završen pravni pregled:

- [Ministarstvo finansija — Zakon o računovodstvu](https://www.mfin.gov.rs/sr/propisi-1/-zakon-o-racunovodstvu-sluzbeni-glasnik-rs-br-732019-1)
- [Ministarstvo finansija — kontni okvir](https://mfin.gov.rs/sr/propisi-1/pravilnik-o-kontnom-okviru-i-sadrzini-racuna-u-kontnom-okviru-za-privredna-drustva-zadruge-i-preduzetnike-sluzbeni-glasnik-rs-br-892020-1)
- [SEF — API specifikacija i aktuelna uputstva](https://www.efaktura.gov.rs/tekst/368/specifikacija-aplikativnog-interfejsa-za-neposredan-pristup-sistemu-elektronskih-faktura.php)
- [APR — finansijski izveštaji](https://www.apr.gov.rs/registri/finansijski-izvestaji.2069.html)

Za svako pravilo evidentirati izvor, verziju, datum primene, vrste firmi i test primer. Pre implementacije proveriti prečišćen tekst i izmene, ne osloniti se na naslov stare objave. SEF portal navodi ažurirano tehničko uputstvo od 1. oktobra 2026; njegov sadržaj i prateće izmene treba analizirati u P5. Ne ponavljati sadašnju opštu tvrdnju da svaki račun domaćoj firmi mora u SEF bez provere obuhvata.

PDV: odvojene poreske kategorije po stavci, datum poreske obaveze, prethodni porez, oslobođenja, avansi i korekcije. PDV evidencija nije samo jedan procenat na fakturi. Pravila i obrasci imaju datum važenja; rezultat čuva verziju pravila i trag obračuna.

SEF: serverski čuvane tajne po firmi, demo/produkcija odvojeni, sačuvan izvorni XML i odgovori, stabilne spoljne reference, kontrolisani retry i usaglašavanje statusa. Pri neizvesnom rezultatu slanja prvo proveriti postojeći dokument; ne slati naslepo ponovo. Prihvatanje u SEF i knjiženje su različiti događaji.

APR i poreski izvozi: interne bilanse ne označavati kao spremne za zakonsku predaju dok mapiranja, važeća šema i validacija nisu provereni. Podrška svakom računovodstvenom okviru i vrsti firme se izričito navodi. Obračun zarada, fiskalizacija i eOtpremnice zahtevaju zasebne specifikacije i ne nastaju implicitno integracijom faktura.

## 11. Odluke koje treba razrešiti tokom rada

Radna pretpostavka je pilot uslužnog DOO sa jednostavnim prometom. Sledeća pitanja usmeravaju kasnije module, ali ne blokiraju P0 i projektovanje P1:

- Koji postojeći knjigovodstveni program i format početnih stanja/otvorenih stavki koristimo za usaglašavanje?
- Da li prvi pilot ima PDV, devize, zaposlene, robu i osnovna sredstva?
- Ko potvrđuje referentne primere kontiranja i poreskog tretmana?
- Koliko firmi, operatera i dokumenata godišnje očekujemo?
- Da li agencija samo priprema prijave ili traži i zvaničnu elektronsku predaju?

Odgovore upisati kao promene odluka, ne menjati finansijska pravila usput u UI komponentama.
