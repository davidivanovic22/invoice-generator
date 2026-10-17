# Interna evidencija zaliha — OPS-03

Obuhvat je RSD evidencija artikala po skladištu sa pokretnim prosekom, potvrđenim prijemom/izlazom, karticama, kontrolom knjige, punim stornom i Excel izvozom. Modul ne određuje poreski tretman ili prodajnu cenu. Knjigovođa bira ukupnu RSD vrednost prijema, protivkonto i, kada konto zahteva, partnera.

## Podaci i kontiranje

Šifra je jedinstvena unutar firme/skladišta. Artikal, skladište, jedinica mere i konto su neizmenjiva istorijska definicija. Novo skladište ili konto koristi novu definiciju. Isti SKU može postojati u različitim skladištima; svaka kombinacija ima sopstveni prosek. Više artikala sme da deli konto zaliha. Konto mora dozvoljavati knjiženje bez partnera. Protivkonto ne može biti drugi registrovani konto zaliha; međuskladišni transfer još nema poseban atomski dokument.

Količine su pozitivni integer stringovi u hiljaditim delovima jedinice mere, do 24 cifre. Vrednosti su RSD pare, takođe integer stringovi do 24 cifre. Pri prikazu/preflight-u koriste se BigInt, u SQL-u exact NUMERIC/div. Zbir po artiklu ne sme preći limit. Nema JS Number obračuna novca/količina.

Prijem duguje konto zaliha i potražuje izabrano protivkonto. Izlaz potražuje konto zaliha i duguje protivkonto. Izlazna vrednost je `round_half_up(preostala_vrednost × izlazna_količina / preostala_količina)`; poslednji izlaz uzima celu preostalu vrednost. Nulta vrednost izlaza ili ostatak sa pozitivnom količinom bez vrednosti odbijaju se zbog izabrane preciznosti. Ne postoji negativna zaliha. Vrednost izlaza nije slobodan klijentski iznos; server je računa iz aktuelne evidencije.

ID izvornog dokumenta/stavke je jedinstven u celoj firmi i ostaje zauzet posle storna. Koristiti stabilan identitet dokumenta i njegove stavke, a ne naziv fajla. Promet i njegov nalog dele isti UUID. Kontiranje se prikazuje pre potvrde. Prijem/izlaz nisu dodatno automatsko knjiženje već knjiženog računovodstvenog dokumenta: birati izvore/protivkonta prema potvrđenoj politici kako se ne bi duplirala nabavna vrednost. Nema automatskog povezivanja internog DOC računa, poreza, fakture ili banke.

## Integritet i storno

Svaka radnja je jedna serverska transakcija: količina/vrednost, nalog, revizija, audit i receipt. Zaključavanje firme serijalizuje i konkurentne izlaze i računovodstvene promene. Deljenje konta ne deli prosek artikala. Aktuelni saldo tog konta mora biti jednak zbiru svih artikala; nepokriven saldo samostalnih naloga blokira upis. Njihovo potpuno usaglašavanje/storno može vratiti kontrolu, uz sačuvanu istoriju.

Datum ne može prethoditi poslednjoj radnji artikla, uključujući storna. Godina/period moraju pripadati istoj firmi, a period biti otvoren. Konto/partner i važnost konta proveravaju se u glavnoj knjizi. Direktni upis/izmena/brisanje novih tabela nisu dostupni klijentu. Nepovezan korisnik ne vidi podatke; čitalac nema komande. Kreiranje artikla zahteva `manage_chart`, prijem/izlaz `post_journal`, storno dodatno `reverse_journal`. Postojeće agencijske dozvole važe na serveru.

Stornira se poslednji aktivni promet artikla, zatim eventualno raniji. Istorijski nalog se potpuno obrće; marker i storno se potvrđuju zajedno. Direktni GL storno aktivnog stock naloga se odbija. Datumi/revizije/zatvoren period odbijaju celu radnju bez delimičnog vraćanja zalihe. Istorija ostaje trajna.

Kod nepoznatog odgovora ekran čuva originalni zahtev i ključ, blokira uređivanje/promenu konteksta i omogućava ponavljanje. Isti ključ vraća isti receipt bez novih naloga; drugačiji payload je odbijen. Pregled svih godina ima limite 1000 artikala i 10000 prometa; prekoračenje se odbija bez skraćivanja. Klijent nezavisno rekonstruiše količine, vrednosti, prosek, storna i revizije i poredi zbir prema knjizi.

## Kartice i izvoz

Ekran pokazuje trenutno stanje, celu karticu izabranog artikla, istoriju storna i kontrolne salde knjige. Excel sadrži četiri lista: stanje, kartice, storna i kontrolu. Čuva firmu/godinu pregleda, obuhvat svih godina, identifikatore izvora/naloga i istorijske prethodne vrednosti. Sve ćelije su tekst sa formatom `@`; veliki iznosi, početne nule i tekst koji počinje `=` ostaju tekst. Neusaglašen pregled nema izvoz.

## Referentni primeri

| Primer | Očekivanje |
| --- | --- |
| Prijem 10 kom / 100 RSD, drugi 10 kom / 200 RSD, izlaz 4 kom | 20 kom / 300 RSD pre izlaza; izlaz 60 RSD; ostatak 16 kom / 240 RSD; isti saldo konta |
| Storno tog izlaza | 20 kom / 300 RSD; povezani puni storno 60 RSD; sačuvana kartica |
| Tri najmanje jedinice količine / 5 para, tri izlaza po jednu | Vrednosti 2 + 2 + 1 para; konačno 0 u obe evidencije |
| Iznos/količina preko JS preciznosti, izlaz sve osim jedne | Tačan ostatak 1, potom konačno 0 |
| Dva istovremena izlaza cele zalihe sa istom revizijom | Jedan uspeva; drugi ne knjiži niti menja stanje |
| Kasniji aktivni promet, raniji storno ili zatvoren period | Odbijeno, bez delimičnog markera/naloga |
| Samostalni saldo konta zaliha | Pregled prikazuje razliku, komande/izvoz blokirani do usaglašavanja |

## Preostale kontrolne tačke

Potrebna je poslovna potvrda kontiranja, jedinica mere i izvora za podržanu firmu, uz DOC-02. Ovaj obuhvat nema FIFO, prodajnu kalkulaciju, PDV obračun, proizvodnju, lotove/serijske brojeve, atomske transfere, originalno-vezane poslovne povraćaje ili godišnji prenos početnih stanja. Popisna korekcija se može izričito evidentirati prijemom/izlazom sa sopstvenim izvornim ID-jem i izabranim kontom; nema automatskog popisnog dokumenta. To su posebna proširenja, a ne nevidljive dodatne podfaze OPS-03.

Šesnaesta migracija `20261009100000_accounting_inventory.sql` uvodi četiri immutable relacijske tabele bez JSON kolona. Prethodnih petnaest migracija nije menjano. SQL provera je `supabase/tests/accounting-inventory.test.py`; integrisana je u izolovani runner. Produkcija i originalna poslovna baza nisu migrirane.

Završne provere prolaze: 56 grupa / 324 unit testa, TypeScript, build, SQL provere zaliha, tri obnove 116 tabela/sekvenci i svi browser delovi. OPS-03 je TECH_DONE u ovom obimu; poslovno prihvatanje ostaje otvoreno. Konkretni izvori, backup-i i nastavci provera su u [pregledu isporuke](ACCOUNTING_DELIVERY_STATUS.md) i [backlogu](ACCOUNTING_BACKLOG.md).
