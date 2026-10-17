# Referentni primeri DOC-02

Datum: 8. oktobar 2026. Status: automatski provereni tehnički primeri, poslovna potvrda nije dobijena. Izvor provera: `supabase/tests/accounting-advances.test.py` i `e2e/accounting.cjs`. Iznosi u tabeli su RSD; transport i baza koriste tačne stringove najmanjih jedinica. Brojevi konta u fixture-ima su test konfiguracija, bez potvrđenog zvaničnog mapiranja.

| Primer | Ulaz | Očekivano ponašanje |
| --- | --- | --- |
| Delimična raspodela | Račun i avans: osnovica 100,00, porez 20,00; primena 40,00 + 8,00 | Transfer 48,00; preostalo na oba izvora 60,00 + 12,00; izdat sadržaj isti |
| Jedan avans, dva računa | Posle prve raspodele drugi račun koristi 10,00 + 2,00 istog avansa | Avans preostalo 50,00 + 10,00; oba računa imaju zasebne veze |
| Dva avansa, jedan račun | Drugi avans primenjuje još 20,00 + 4,00 na prvi račun | Preostalo prvog računa 40,00 + 8,00 |
| Paralelno prekoračenje | Dva zahteva za po 80,00 + 16,00 protiv izvora 100,00 + 20,00 | Tačno jedan commit; drugi se odbija, bez naloga i raspodele |
| Razdvojena izvorna konta | Avans bruto 120,00: 100,00 na jednom i 20,00 na drugom kontu | Jedno konto sa saldom 100,00 ne može preneti 120,00 |
| Knjižena korekcija tog konta | Prvi saldo umanjen za 50,00; raspoložive komponente avansa 50,00 + 20,00 | Zahtev 70,00 na kontu sa preostalih 50,00 se odbija |
| Poništavanje | Aktivna primena 40,00 + 8,00, razlog, otvoren period | Puni storno 48,00, vraćanje raspoloživih komponenti; originalni transfer ostaje |
| Zatvoren period | Isti zahtev poništavanja u zatvorenom periodu | Nema storna niti poništavanja; raspodela ostaje aktivna |
| Izgubljen odgovor | Server potvrdi primenu 40,01, odgovor se prekine; retry isti ključ | Jedna raspodela i jedan transfer; isti receipt, preostalo 60,00 od 100,01 |
| Ulazni smer | Avans i račun istog dobavljača | Strane transfera su obrnute u odnosu na izlazni smer |
| Korekcija aktivnog izvora | Korekcija traži više od preostalih komponenti | Izdavanje se odbija dok se raspodela ne poništi ili uskladi |
| Nezavisni storno izvora | Pokušaj storna izvornog ili transfer naloga sa aktivnom raspodelom | Odbija se; poništavanje raspodele je jedini tok storna transfera |

Za poslovnu potvrdu treba dopuniti konkretan primer iz postojećeg programa: vrstu firme i smer, avansni i konačni dokument, dokaz uplate/izvod ako postoji, izvorna konta, knjiženje zatvaranja, porez po kategoriji i eventualne dodatne PDV stavke. Upisati ko je proverio primer i prema kom izvoru/računovodstvenoj politici. Trenutni transfer ne obračunava PDV razduženje i ne potvrđuje plaćanje; modul PAY-02/P5 mora zasebno obraditi te podatke.

## Bankarske raspodele PAY-02 — tehnički primeri

Izvori: `supabase/tests/accounting-payments.test.py`, domen/adapter/panel testovi i `e2e/accounting.cjs`. Poslovna potvrda nije dobijena. Sama potvrda raspodele čuva bankarski dokaz i računa usaglašavanje dokumenta; zasebne eksplicitne ledger akcije opisane su ispod.

| Primer | Ulaz | Očekivano ponašanje |
| --- | --- | --- |
| Delimična naplata | Bankarski priliv 150,01; račun 100,01; raspodela 40,01 | Plaćeno 40,01, otvoreno 60,00; neraspoređeno u banci 110,00 |
| Više dokumenata | Još 60,00 prvom računu i 50,00 drugom | Prvi račun zatvoren; ukupno 150,01 raspoređeno; druga uplata/višak nisu izmišljeni |
| Delimičan povraćaj | Odliv 100,01; povraćaj 20,00 od prethodne raspodele 40,01 | Neto plaćeno na računu smanjuje se za 20,00; 80,01 odliva ostaje neraspoređeno |
| Prekoračenje povraćaja | Nakon povraćaja 20,00 zahtev 20,02 protiv prethodnih 40,01 | Odbija se ceo zahtev; preostali povraćaj je 20,01 |
| Poništavanje sa zavisnošću | Uplata ima aktivan povraćaj | Prvo poništiti povraćaj, zatim uplatu; oba originalna traga ostaju |
| Naknadna korekcija | Original 100,01; aktivno plaćeno 60,00; knjižno odobrenje 50,00 | Nova obaveza 50,01, prikazana preplata 9,99; izvorna uplata se ne skraćuje |
| Usaglašavanje preplate | Povezan povraćaj 9,99 protiv aktivne raspodele | Neto bankarski plaćeno 50,01, preplata 0,00 |
| Avans i konačni račun | Avansna primena 40,01; konačni račun 100,01; bankarska raspodela 60,00 konačnom i 40,01 avansnom dokumentu | Konačni račun otvoreno 0,00; avansni zadržava bankarski dokaz 40,01 |
| Poništavanje avansnog transfera | Prethodni transfer 40,01 se stornira | Konačni račun ponovo otvoreno 40,01; bankarsko plaćeno ostaje 60,00; avansni dokaz 40,01 ostaje |
| Paralelna raspodela | Dva zahteva po 0,80 protiv iste bankarske transakcije/računa od 1,00 | Jedan commit, preostalo 0,20; drugi zahtev se odbija |
| Izgubljen odgovor | Commit raspodele 40,01, prekid odgovora, isti retry ključ/payload | Jedna raspodela; unos i izlazak zamrznuti dok se originalni zahtev ne razreši |

Za zatvaranje PAY-02 treba potvrditi stvarni izvod i stabilne bankarske ID-jeve, identitet partnera, način vođenja preplate/avansa/povraćaja i tačno knjiženje bankarskog izvora/raspodela. Tehnička veza sa glavnom knjigom sada postoji, ali konkretna poslovna konta/politika nisu potvrđeni. `paid` i dalje znači izvedeno bankarsko usaglašavanje; zasebni ledger status pokazuje knjiženje. Puni partnerski izveštaji i starosna struktura ostaju REP-02.

## Bankarska knjiženja PAY-02 — tehnički primeri

Izvor: `supabase/tests/accounting-payment-ledger.test.py` i browser tok. Brojevi konta u testu su sintetički; nisu potvrđen zvanični šablon.

| Primer | Izvor/radnja | Očekivani trag |
| --- | --- | --- |
| Puno knjiženje banke | Priliv 150,01; račun 100,01 | Banka duguje 150,01, prelaz potražuje 150,01; račun nije zatvoren samim knjiženjem banke |
| Delimično zatvaranje | Potvrđena i proknjižena raspodela 40,01 | Prelaz duguje 40,01, analitika računa potražuje 40,01; prelaz preostalo 110,00, izvorni račun 60,00 |
| Konačno zatvaranje | Druga raspodela 60,00 | Račun 0,00, na prelazu ostaje višak 50,00; nema automatskog avansnog dokumenta |
| Raspodela bez knjiženja | Potvrđena raspodela 40,01 bez ledger akcije | Bankarski status se menja; prelaz ostaje 150,01, panel pokazuje 40,01 neproknjiženih raspodela |
| Povraćaj 20,00 | Odliv 30,00 i povezan proknjižen refund | Banka potražuje 30,00/prelaz duguje 30,00; refund potražuje prelaz 20,00/duguje isti konto računa 20,00; preostali odliv 10,00 |
| Poništavanje refund-a | Razlog, otvoren period, datum nakon njegovog naloga | Puni storno i cancellation u istom commit-u; izvorni bankarski iznos ostaje neizmenjen |
| Zatvoren period poništavanja | Isti pokušaj u zatvorenom periodu | Nema cancellation-a/storna/receipt-a; raspodela i prethodni saldi ostaju aktivni |
| Zavisnosti storna | Direktno storno banke, dokumenta ili aktivne payment raspodele | Odbijeno; prvo kontrolisano poništavanje zavisnih raspodela, refund pre originalne uplate |
| Avans nakon naplate | Račun potpuno zatvoren bankarskim knjiženjem; pokušaj avansnog transfera na isto konto | Odbijeno zbog nedovoljnog izvornog salda, bez dvostrukog zatvaranja |
| Prekid odgovora | Server knjiži pun bankarski izvor, odgovor se prekine, retry istog ključa | Jedan nalog i ista izvorna veza/receipt; kontekst ostaje blokiran do razrešenja |

Za poslovnu potvrdu zabeležiti firmu/partnera, stvarni izvod i isprave, izabrana konta/period/datum, očekivane naloge i salda pre/posle, politiku preplate i proveru storna. Dodati ime knjigovođe, datum i izvor politike. Prolazak sintetičkih testova ne popunjava tu potvrdu.

## Interni izveštaji REP-01 — tehnički primer

Izvor: `supabase/tests/accounting-reports.test.py`, domain/Excel testovi i browser tok. Ovo su sintetički RSD primeri, nisu potvrđena početna stanja stvarne firme.

| Primer | Očekivani rezultat |
| --- | --- |
| Početni saldo 40,01 duguje / prihod 40,01 potražuje; u rasponu promet 100,01 i korektivni promet 10,00 | Konto potraživanja: tekući saldo 140,02, zatim 130,02. Prihod: -140,02, zatim -130,02. Bruto promet ukupno 110,01 duguje i potražuje; završni saldo ukupno 130,02 na obe strane. |
| Dva ranija naloga od 999999999999999999999999 para i kasnije puno storno jednog uz promet 150 para | Agregati mogu imati 25 cifara; nema JS/Excel zaokruživanja. Storno ostaje zaseban nalog u dnevniku. |
| Sačuvan neproknjižen nacrt | Nema promene izveštaja. |
| 105 naloga, workspace prikazuje poslednjih 100 | Izveštaj obuhvata svih 105. |
| Raspon sa više od 10000 stavki | Zahtev se odbija; nema delimičnog prikaza ili izvoza. Sužen datum koristi sve ranije promete iste godine za početni saldo. |
| Tekst opisa/partnera počinje `=` | Excel ćelija ostaje string sa tekst formatom, bez formule. |
| Promena datuma/firme/godine | Raniji izveštaj i izvoz se uklanjaju; zakasneli odgovor ne preuzima novi kontekst. |

Za poslovno zatvaranje usaglasiti stvarno preneta početna stanja, sve promete i salda po kontu sa referentnim sistemom (MIG-01), posebno granice godine i korektivne naloge. Interni izveštaj ne prenosi prethodnu godinu automatski i nije potvrđen godišnji/poreski obrazac.

## Trenutna analitika partnera — REP-02 za poslovnu proveru

| Primer | Podaci / postupak | Očekivanje |
| --- | --- | --- |
| Delimično naplaćen račun | Knjižen kupac 120,00; evidentirano i knjiženo 40,00 | Otvoreno 80,00; kontrola 80,00 prema 80,00, razlika 0 |
| Neknjižen izvor | Izdat račun 2,00 bez source naloga | Evidencija 2,00, knjiženja 0, razlika −2,00; nedostaje analitičko knjiženje |
| Kupac / dobavljač | Isti partner duguje 80,00 na 204 i ima obavezu 7,00 na 435 | Dve kartice i dva zbira dospeća; nema prebijanja u 73,00 |
| Neknjižena korekcija | Račun 100,01, izdato odobrenje 10,00 bez knjiženja | Evidencija 90,01, knjiga 100,01, razlika +10,00 i neusaglašeni izvor; posle knjiženja odobrenja razlika 0 |
| Storno korekcije | Storniran nalog odobrenja, izdato odobrenje ostaje | Knjiga ponovo 100,01, evidencija 90,01, razlika +10,00; original i storno ostaju |
| Neknjižena raspodela | Na gornji račun potvrđeno 40,01 bez allocation knjiženja | Evidencija 50,00, knjiga 100,01, razlika 50,01; nakon knjiženja raspodele knjiga 60,00, razlika 10,00 zbog stornirane korekcije |
| Poništavanje / avans | Poništena raspodela, zatim preneto 5,00 avansa i poništen transfer | Za vreme transfera i knjiga i evidencija opadaju za 5,00; poništavanje vraća oba; avansni prenos se prikazuje zasebno |
| Samostalni nalog | Početno stanje / ručni nalog 1,00 | Kartica ga sadrži; kontrola računa ga ne pripisuje računu; samostalno 1,00 zahteva poslovno tumačenje |
| Nulta zbirna razlika | Suprotne razlike neknjiženih izvora daju zbir 0 | Nije usklađeno dok broj neknjiženih/storniranih aktivnih payment/korektivnih izvora nije 0 |
| Granice starosti | Dospeće danas/sutra, pre 1/30/31/60/61/90/91 dana | Nedospelo/danas, 1–30, 31–60, 61–90, 91+ tačno na granicama kalendarskih dana |
| Preplata / avans | Račun 120,00, aktivno plaćanje 140,00; poseban avans 40,01 | Dug 0 i preplata 20,00 zasebno; avans ne povećava starost niti se predstavlja kao neiskorišćen iznos |
| Godine / obuhvat | Knjiženja i dokument iz 2025 uz 2026 | Obe godine uključene; sva sačuvana knjiženja, bez automatske migracije/prenosa i istorijskog preseka |
| Celovitost / prava | Preko 100 stavki, zatim preko 10.000; read korisnik / opoziv agency consent | Sve do granice; preko granice ceo zahtev odbijen; drugi partner može se učitati; opoziv odmah zabranjuje read |
| Izvoz / kontekst | Excel istog snimka; promenjen partner/firma/godina | Tri lista i tekstualni iznosi/ID-jevi/zbirovi; stari izvoz i zakasneli odgovor se odbacuju |

Primeri su sintetički, nisu poslovna potvrda. Potrebno je poređenje sa potvrđenim početnim stanjima i referentnim knjigovodstvenim programom pre zatvaranja REP-02 i njegovih PAY-02/REP-01 zavisnosti. Poslovni datum služi starosti trenutnih podataka; istorijski saldo na proizvoljan datum nije podržan.

## FX-01 — monetarne stavke i vrednovanje, za poslovnu proveru

| Primer | Ulaz / postupak | Očekivanje |
| --- | --- | --- |
| Početno potraživanje | 100,00 EUR, kurs 117,000000 RSD za 1; posebno analitičko konto i protivkonto | Original ostaje 100,00 EUR; novi nalog D partner 11.700,00/P protivkonto 11.700,00; sačuvan kurs/datum/objava/izvor/dokaz |
| Rast potraživanja | Kurs 119,000000 | Nova vrednost 11.900,00; poseban nalog D partner/P prihod 200,00; izvorna vrednost 11.700,00 ostaje |
| Pad nakon rasta | Novi kurs 116,000000 | Vrednost 11.600,00; D rashod/P partner 300,00 prema 11.900,00, ne 100,00 prema prvom kursu |
| Obaveza | 100,00 EUR po 117, zatim 119 | Rast obaveze 200,00 je D rashod/P partner; pad kursa koristi prihod |
| Prikaz prihoda/rashoda | Obaveza 100,00 EUR po 117, novi kurs 116 | Promena vrednosti −100,00 RSD; prikaz prihoda 100,00 RSD, uz pozitivne D/P stavke naloga |
| Quote units | Kurs 11.700,000000 za 100 jedinica | Isti rezultat kao 117 za jednu; multiplier je sačuvan i ne podrazumeva se |
| Polovina najmanje jedinice | 0,01 EUR po 0,500000 RSD za 1 | 0,01 RSD; niži kurs daje 0 i nije podržano početno knjiženje |
| Veliki tačan iznos | 9.007.199.254.740.993,01 deviznih jedinica po 1 RSD | Tačan isti RSD iznos; NUMERIC div i BigInt ne dodaju jednu paru pre floor-a |
| Pogrešan kurs / vreme | Negativan/0 kurs, naučna notacija, više od 6 decimala, objava posle primene, primena posle knjiženja | Odbijeno, bez naloga/FX zapisa/receipt-a |
| Redosled storna | Dve aktivne razlike; pokušaj poništavanja prve | Odbijeno; prvo puni storno poslednje, zatim prethodne; originalni kursevi ostaju |
| Zatvoren period | Poništavanje poslednje razlike u zatvorenom periodu | Odbijeno; nema cancellation-a/storna/receipt-a; prethodni saldo i revizija ostaju |
| Poništavanje izvora | Posle svih storniranih razlika, razlog i otvoren period | Puni storno početnog naloga; zatvorena FX stavka sa istorijom; nije naplata |
| Nezavisni storno / dupli izvor | Direktni core storno aktivnog FX naloga; druga aktivna pozicija istog konto/partner para | Odbijeno; koristi se kontrolisani FX tok |
| Nezavisna promena glavnice | Ručno/RSD payment knjiženje na posebnoj FX analitici | Vidljiva oznaka i blokada vrednovanja/poništavanja; ne zaključivati preostalu deviznu glavnicu iz RSD iznosa |
| Prekid / race | Izgubljen odgovor posle upisa i isti retry; dva zahteva sa istom revizijom | Jedan nalog/prvi receipt; jedan race pobednik; nepoznat ishod zaključava unos/kontekst |
| Read / agency | Čitalac, nepovezana firma, opozvana eksplicitna agency dodela | Čitalac vidi istoriju bez komandi, drugi/opozvani pristup odbijen |
| Izvor pre potvrde | Initial/revaluation, zatim storno | Pregled D/P sa tačnim iznosima/kontima/partnerom pre slanja; storno iz originalnih neizmenjivih stavki |

Knjigovođa treba da potvrdi okvir firme, monetarnu prirodu stavke, stvarne izvore/kurseve/datume i kontnu politiku, te odsustvo duplog knjiženja već evidentiranih izvora. Devizna naplata i realizovana razlika po delimičnoj glavnici nisu podržane u ovoj celini; potrebni su zasebni referentni primeri. Sintetički 117/119/116 kursevi služe proveri računanja, nisu stvarna NBS kursna lista.

## FX-01 — dopuna: ručno plaćanje i realizovane razlike

Primeri ispod dodaju obim trinaeste migracije. Kursevi su sintetički; bankarski izvor i konta mora poslovno potvrditi knjigovođa. Postojeće knjiženje izvoda se ne šalje ponovo kao novo ručno plaćanje.

| Primer | Ulaz / postupak | Očekivanje |
| --- | --- | --- |
| Delimično potraživanje | 100,00 EUR po 117; plaćeno 40,00 EUR po 120 | Zatvoreno 4.680,00 RSD, D novac 4.800,00/P partner 4.680,00/P prihod 120,00; preostalo 60,00 EUR i 7.020,00 RSD |
| Plaćanje posle vrednovanja | Početno 117, zatim 119; 40,00 EUR po 120 | Raspodela po aktuelnih 11.900,00: 4.760,00 RSD, realizovani prihod 40,00; preostalo 60,00 EUR i 7.140,00 RSD |
| Preostala glavnica | Posle prvog primera, kurs preostalih 60,00 EUR je 118 | Novo 7.080,00 RSD, nerealizovana razlika +60,00; ne preračunavati ponovo originalnih 100,00 EUR |
| Smerovi | 100,00 EUR početno 117, puno plaćanje po 119 ili 115 | Potraživanje: prihod/rashod 200,00; obaveza: rashod/prihod 200,00; svaki nalog uravnotežen |
| Nulta razlika | Plaćanje po istoj RSD knjigovodstvenoj vrednosti | Dve pozitivne D/P stavke; nema nulte treće stavke |
| Konačni ostatak | Originalne 3 najmanje devizne jedinice po 0,5 daju 2 RSD pare; zatvorena jedna jedinica | Prvo zatvorena 1 para; završne dve jedinice zatvaraju ceo preostali RSD od 1 pare, bez preostalog salda |
| Nedovoljna preciznost | Preostale 2 devizne jedinice i 1 RSD para; pokušaj plaćanja samo 1 jedinice | Odbijeno; delimično plaćanje ne ostavlja deviznu glavnicu bez pozitivnog RSD ostatka |
| Veliki iznosi | 900719925474099301 minor jedinica po kursu 1; zatvaranje svih osim jedne | Tačan RSD ostatak 1, koji konačno plaćanje zatvara; nema JS Number ili običnog NUMERIC deljenja |
| Mešovito storno | Plaćanje, zatim vrednovanje ostatka; pokušaj storna plaćanja | Odbijeno do storna kasnijeg vrednovanja; posle toga puni storno plaćanja vraća obe pređašnje vrednosti |
| Izvor i duplikat | Različite firme/stavke/konta, isto firm+račun+ID; drugačiji razmaci/crtice/veličina slova računa | U istoj firmi duplikat je odbijen i posle storna; promena konta novca ne pomaže; račun je sačuvan normalizovan |
| Postojeći izvod | Račun/ID već registrovan u bankarskom modulu | Ručni FX tok odbijen; potrebno buduće kontrolisano povezivanje |
| Preplata / valuta | Veći devizni iznos od preostalog ili druga valuta | Odbijeno bez naloga/plaćanja/receipt-a; nema automatskog avansa ili konverzije |
| Zatvoren period | Novo plaćanje ili storno u zatvorenom periodu | Cela transakcija odbijena; nema delimičnog markera/storna/knjiženja |
| Nepoznat odgovor | Prekid posle upisa, isti zamrznuti zahtev/ključ | Prvi receipt, jedan nalog; unos i promena konteksta blokirani do ponavljanja |
| Potpuno izmireno | Aktivna plaćanja zatvorila svu glavnicu | Preostalo 0 devizno/RSD; novo vrednovanje ili plaćanje odbijeno; poslednje plaćanje može da se stornira |
| Kontrola / čitalac | Sačuvana istorija, read-only/agency/opozvani pristup | Potpuni tačni podaci bez write kontrola; ukidanje pristupa odmah važi; usaglašavanje se odnosi na FX analitiku, ne na stvarni bankarski saldo |

Poslovna potvrda treba da obuhvati i politiku delimične raspodele/ostatka, izabranu RSD vrednost konta novca, bankarski dokaz, način knjiženja realizovanih razlika i korekcije identiteta izvora. Bankarski povraćaj, naknade, preplate i zamena prethodno storniranog bankarskog ID-ja zahtevaju zasebnu dopunu; ne predstavljaju se kao završeni.

## Devizni Excel izvodi i postojeća plaćanja — četrnaesta migracija

Petnaesta migracija proširuje proveru na [knjiženje bankarskog izvora, više raspodela, naknade, zaokruživanje i mešoviti storno](ACCOUNTING_FX_BANK_POSTING.md#referentni-primeri-i-preostale-granice). Poslovna potvrda obuhvata i izabrano prelazno konto, knjigovodstveni kurs konta novca, klasifikaciju ostatka i razliku između izlazne naknade i provizije odbijene od priliva.

[Referentne provere deviznih izvoda](ACCOUNTING_FX_BANK.md#referentne-provere) pokrivaju tačan uvoz, saldo, konflikte u oba redosleda prijema, povezivanje bez duplog naloga, storno, velike iznose, konkurentnost i izgubljen odgovor. Poslovna potvrda treba da proveri konkretan bankarski Excel adapter, izabrano konto novca, datum knjiženja i identitet banke/računa/transakcije. Kontrola pojedinačnog izvoda ne potvrđuje početno stanje ili kontinuitet svih izvoda.

## TAX-01 — poreska matrica i referentni obračuni

[Poreski primeri i datumi primene](ACCOUNTING_TAX_RULES.md#referentni-primeri) obuhvataju redovni PDV, potvrđenu posebnu stopu, malog obveznika, razdvajanje PDV računa od prava na odbitak, velike iznose i granice zaokruživanja. Avansi, korekcije, oslobođenja i nepodržane verzije ne dobijaju prećutni obračun. Knjigovođa treba da potvrdi dokaze režima i klasifikacije, izabranu internu politiku zaokruživanja i granice podržanih slučajeva. Referentni ekran ne čuva poreski profil i ne pravi dokumente, naloge ili prijave; to je naredni TAX-02.

## TAX-02 — trajna interna evidencija

[Novi trajni scenariji i granice](ACCOUNTING_TAX_EVIDENCE.md#referentni-scenariji-i-otvoreni-razvoj) proveravaju datirane profile, tačan PDV izvora, izričito potvrđen odbitak, nepokrivene dokumente, istoriju poništenja i stvarni tekstualni Excel. Primer prodaje sa PDV 200,00 i nabavke sa PDV 100,00 / odbitkom 50,00 daje kontrolnu razliku 150,00 RSD bez dodatnih naloga. To nije konačna poreska obaveza niti potvrda podnete prijave. TAX-02 ostaje delimičan do preostalih datiranih obračuna i regulatornog izvoza.
