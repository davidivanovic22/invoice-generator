# MIG-01 — početna RSD stanja i otvorene stavke

Deklarisan obuhvat: kontrolisan početni presek na prvi dan poslovne godine, sa prethodnim danom kao datumom izvora. Podržani su RSD salda i preostala pojedinačna potraživanja/obaveze. Operater ručno mapira izvorna konta i partnere na registre konkretne firme. Uvoz nije automatska konverzija legacy JSON kopije ili ranije izdatih faktura.

## Izvor i postupak

U odeljku „Probna migracija i početna stanja” preuzeti Excel šablon. Dozvoljena su tačno tri vidljiva lista, navedeni zaglavlja i tekstualne ćelije; formule, numeričke/datumske Excel ćelije, skriveni redovi/kolone/listovi, višak kolona i prazni redovi se odbijaju. Fajl je `.xlsx`, do 5 MB, do 500 salda i 500 otvorenih stavki.

| List | Kolone / sadržaj |
| --- | --- |
| Meta | `key,value`: `version=1`, `currency=RSD`, `source_tax_id`, `as_of`, `source_reference` |
| Stanja | `source_account,source_partner,debit_rsd,credit_rsd` |
| Otvorene | `source_account,source_partner,external_id,number,document_date,due_date,direction,remaining_rsd` |

Iznosi su tekst u RSD sa najviše dve decimale, bez separatora hiljada. PIB mora biti isti kao identitet izabrane firme. Svako saldo ima samo duguje ili potražuje, a zbir D=P. Konto sa obaveznim partnerom mora imati izvorni i ciljni partner i pojedinačne stavke čiji zbir potpuno pokriva saldo, odvojeno za `receivable` i `payable`, bez netiranja. Za konto bez partnera stavke nisu dozvoljene. Datum izvornog dokumenta prethodi početku godine; dospeće nije pre datuma dokumenta.

Probni pregled proverava kontekst, važenje konta, mapiranja, datume i iznose u memoriji. Ne upisuje dokument, nalog, audit ili receipt. Posle provere se prikazuju otvorene stavke i konkretan D/P nalog pre potvrde. Originalni fajl dobija SHA-256; u relacijama se čuvaju identitet izvora, hash, mapiranja, originalni redosled i pojedinačni iznosi. Hash omogućava poređenje fajlova, ali ne potvrđuje poslovnu ispravnost izvora.

## Jedno početno knjiženje

Server zaključava firmu i potvrđuje ceo paket u jednoj transakciji. Dozvoljena je knjiga bez redovnih knjiženja i izdatih internih poslovnih dokumenata i bez drugog aktivnog početnog paketa. Postojeći legacy podaci ostaju izvan ovog knjiženja. Partnerske zbirne redove zamenjuju pojedinačne otvorene stavke u istom nalogu — zbir i stavke se ne knjiže oba puta. Nema novog izdavanja istorijskih faktura, novih poreza ili dupliranja novca.

Izvorna oznaka je trajno jedinstvena po firmi. Svaka komanda ima ključ i hash sadržaja; isti ključ/sadržaj vraća originalni rezultat, drugačiji sadržaj sa istim ključem se odbija. Nepoznat odgovor zamrzava unos i promenu konteksta dok se ne ponovi isti zahtev.

Dnevnik prikazuje početni nalog. Glavna knjiga i bruto bilans uključuju njegove iznose u početni saldo, izvan tekućeg prometa. Partnerske kartice uključuju stvarne redove naloga, a starost uključuje preostale migrirane stavke uz filter partnera. Kontrola poredi njihov preostali saldo i knjigu; kasniji računi i samostalni nalozi mogu napraviti razliku koju operater mora objasniti.

## Plaćanje i ispravka

Za zatvaranje početne stavke bira se već potvrđen slobodan ručni nalog, njegov tačan red sa istim partnerom/kontom i odgovarajućim smerom. Prikazuju se postojeći redovi pre potvrde. Komanda pravi samo vezu, bez novog naloga ili knjiženja novca. Raspodele ne smeju prekoračiti preostalu stavku ili zbirno iznos istog reda naloga. Nalog koji je storniran ne može ponovo služiti kao izvor; njegov storno ponovo otvara sve povezane početne stavke uz novu reviziju.

Početni paket može biti storniran samo dok nema redovnih knjiženja, u otvorenom periodu iste godine, na originalni datum početka. Server atomski pravi povezan suprotan nalog, marker i audit sa razlogom. Direktan storno početnog naloga se odbija. Potom je moguć novi, eksplicitno označen ispravljeni paket, uz očuvanje oba izvora. Posle daljeg poslovnog prometa automatska zamena početnog paketa nije dozvoljena.

Četvorolistni izvoz kontrole: `Izvori`, `Stanja`, `Otvorene`, `Povezivanja`; novac, ID-jevi, SHA i tekst ostaju tekstualne ćelije. List `Stanja` uključuje i poređenje preostalih početnih stavki sa stvarnim saldom knjige i razliku. Šest novih neizmenjivih tabela ima složene veze po firmi, RLS i samo čitanje za klijenta; upis ide autorizovanim RPC komandama. SQL obnova proverava snapshot i ponavljanje izvornog uvoza bez duplikata.

## Granice i prihvatanje

Devizne stavke, istorijski avansi/preplate/povraćaji, poreske evidencije, količinski početak zaliha i godišnji automatski prenos nisu deo ovog uvoza. Potrebni su posebni izvori i odgovarajući moduli; ne pretvarati ih u obične otvorene fakture. Prihvatljivost stvarnog početnog stanja zahteva knjigovođino usaglašavanje sa izvornom bruto bilansom i pojedinačnim stavkama i operativni oporavak REL-05. Lokalni sintetički testovi ne zamenjuju tu potvrdu.

Referentni SQL primer: početno D/P 120,00 RSD, AR 40+60 RSD, AP 50 RSD, banka 20 RSD, kapital 70 RSD. Postoji pet redova jednog naloga; promet je nula. Veza postojećeg plaćanja od 40 RSD raspodeljuje 20+20 bez novih naloga; dodatni 0,01 RSD se odbija. Storno plaćanja vraća prvobitne stavke. Testovi uključuju konkurentne raspodele, zatvoren period, odbijene strane firme, neizmenjivost i iznose iznad bezbednog opsega JavaScript brojeva.
