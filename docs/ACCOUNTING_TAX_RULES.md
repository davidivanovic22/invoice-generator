# TAX-01 — verzionisana referentna poreska matrica

Verzija: `rs-vat-reference-2026-v1`. Provera izvora: **9. oktobar 2026.** Obuhvat obračunskih primera: 1. januar–31. decembar 2026. Status poslovne potvrde: otvoren.

## Šta je isporučeno

Izvršiva matrica je u `src/domain/accounting/tax.ts`, a ekran „Poreska pravila i referentni primeri” u radnom prostoru knjigovodstva. Ekran prikazuje zakonski osnov, uslove, datume, izvore i rezultat provere. Primer ima izričito izabran režim sa intervalom i dokazom, identitet firme i poresku kategoriju. DOO i preduzetnik imaju iste kontrole; režim se ne izvodi iz pravne forme.

Ovo je referentna politika za naredni modul, bez čuvanja podešavanja ili izmena dokumenata/glavne knjige. Promena firme/godine briše primer. TAX-02 dodaje trajni režim firme, serversko potvrđivanje poreskih događaja i evidencije; mora sačuvati verziju, ulazne dokaze i originalni rezultat. Klijentski primer ne može biti autoritet za poresku prijavu.

## Primarni izvori i identitet preuzetog teksta

Ministarstvo objavljuje **nezvanično prečišćene tekstove redakcije Službenog glasnika**. Zvaničan sajt ne pretvara prečišćeni tekst u originalno izdanje glasnika. Informativni pregled Poreske uprave služi za dodatnu proveru, ne za određivanje promena iz 2026.

| Izvor | Identitet proverene datoteke |
| --- | --- |
| [Zakon o PDV](https://www.mfin.gov.rs/sr/propisi-1/zakon-o-porezu-na-dodatu-vrednost--21), uključuje 109/2025 i 80/2026 | [DOCX](https://www.mfin.gov.rs//upload/media/5MwIQ2_6aa12716d86e0.docx), 80406 bajtova; SHA256 `a03ad9356664763f1d487bcc3d8ca0795ce9c0b4cf8b8f00f6dd0e3e39f8d8e0` |
| [Pravilnik o PDV](https://www.mfin.gov.rs/sr/propisi-1/pravilnik-o-pdv-1), uključuje 30/2026 i 71/2026 | [DOCX](https://www.mfin.gov.rs//upload/media/etLuKX_6a82da496119b.docx), 249757 bajtova; SHA256 `f89f574dc7e0d242514a512432b92709f295b24f308ce410c16aad06a64431de` |
| [Opšte o PDV — Poreska uprava](https://www.purs.gov.rs/pravna-lica/pdv/opste-o-pdv.html) | Informativni HTML, provereno 2026-10-09 |

Hash identifikuje preuzeti dokument, ne potvrđuje pravnu tačnost niti nepromenljivost internet adrese. Nema automatskog preuzimanja novih stopa tokom rada. Promena izvora zahteva novu verziju, proveru primene i testove; prethodni događaji moraju zadržati prvobitnu verziju.

## Pravila i vremenske granice

| Osnov | Obuhvat |
| --- | --- |
| Čl. 23 | Opšta stopa 20%; posebna 10% uz potvrđenu klasifikaciju i tačku stava 2. |
| Čl. 33 | Mali obveznik bez obračuna PDV; razlikuje se od poreskog oslobođenja. |
| Čl. 24 / 25 | Zasebne kategorije oslobođenja sa / bez prava na odbitak; ručna provera. |
| Čl. 28–30 | Odbitak prethodnog poreza nije potvrđen samim izračunavanjem PDV na nabavci. |
| Čl. 16 / 21 | Avans i korekcija traže datiranu proveru i vezu sa izvornim događajem. |

Za izmene 109/2025 proverena je prelazna odredba čl. 12: opšta primena od perioda april/april–jun 2026, sa posebnim izuzecima. Za Pravilnik 30/2026 proveren je čl. 29; za 71/2026 čl. 19: pojedine izmene od septembra 2026, opšta primena od perioda januar/januar–mart 2027. Zakon 80/2026 čl. 17 predviđa opštu primenu od 2027, sa izuzecima, uključujući čl. 7 od 15. decembra 2026. Datumi nisu jedna globalna verzija svih poreskih pravila.

Stope ovog kalkulatora iz čl. 23 nisu promenjene tim prelaznim odredbama. Matrica ne implementira nove obrasce, odbitak, korekcije ili automatsko izveštavanje. TAX-02 mora proveriti odgovarajući tekst po odredbi/periodu, uključujući čl. 12–16 izmene 80/2026 i izuzetke od dana stupanja na snagu. Događaji izvan 2026 i avans/promet preko granice verzija odbijaju automatski obračun.

## Referentni primeri

| Primer | Očekivan rezultat |
| --- | --- |
| Domaća prodaja, redovni PDV, osnovica 1000,00 RSD | PDV 200,00; ukupno 1200,00 RSD |
| Posebna stopa, potvrđen osnov čl. 23 st. 2 tač. 1, 1000,00 RSD | PDV 100,00; ukupno 1100,00 RSD |
| Posebna stopa bez dokaza | Potrebna provera; nema izračunatog PDV |
| Nabavka redovnog PDV obveznika, 1000,00 RSD, opšta stopa | PDV računa 200,00; odbitak nije utvrđen |
| Prodaja malog obveznika po čl. 33, 1000,00 RSD | PDV se ne obračunava; ukupno 1000,00; stopa nije opšta „0%” |
| Avans 1. septembra, promet 9. oktobra 2026 | Datum ranijeg događaja 1. septembar; obračun/usaglašavanje ide na proveru |
| Oslobođenja / interni obračun / uvoz / izvoz | Posebna provera ili nepodržan obračun; nema prećutne stope 0% |
| Promet 1. januara 2027 | Nepodržana verzija; nema obračuna |
| Osnovica 0,05 RSD, posebna stopa | PDV 0,01; ukupno 0,06 po referentnom zaokruživanju |
| Osnovica 9007199254740993,01 RSD, opšta stopa | PDV 1801439850948198,60; ukupno 10808639105689191,61 RSD |

Računa se jednom po stavci iz neto osnovice, u parama, bez JS floating-point brojeva; pola pare zaokružuje se naviše. To je **interna politika koju knjigovođa mora potvrditi**, nije tvrdnja da propis određuje isti postupak za sve obrasce. Nema obrnutog računanja iz bruto iznosa, negativnih stavki, automatske korekcije, raspodele avansa ili zbirnog zaokruživanja prijave.

## Konačne granice ovog zadatka i naredni ceo blok

Podržani su referentni primeri obične domaće RSD prodaje redovnog PDV obveznika i malog obveznika, kao i izračunavanje PDV na običnoj domaćoj nabavci redovnog PDV obveznika. Dobavljač je poreski dužnik; klasifikacija i status su izričito navedeni dokazi koje korisnik potvrđuje. Nisu podržani sistem naplate, posebni postupci, strane valute, promet u inostranstvu, carina, proporcionalni odbitak, automatski pragovi/rokovi, zarade, porez na dobit, poreska amortizacija ili druge pravne forme. Te oblasti zahtevaju zasebne datirane politike; TAX-01 ih ne proglašava implementiranim.

Sledeći ceo zadatak je **TAX-02**: trajni datirani PDV profil firme, poreski događaji povezani sa dokumentima, kontrolisana evidencija i periodni izvoz u potvrđenom obuhvatu. Poslovno prihvatanje TAX-01 traži potvrdu matrice, dokaza i politike zaokruživanja na primerima stvarnih firmi. SEF/zarade/amortizacija ne mogu koristiti ovu matricu kao automatsku potvrdu svojih posebnih pravila.
