# TAX-02 — trajni profili i interna PDV evidencija

Datum: 11. oktobar 2026. **TAX-02 je delimično implementiran.** Ovaj blok donosi četiri interne celine: datirani profil firme, poreske događaje sa dokazima, kontrolisanu periodnu evidenciju i tekstualni Excel izvoz. Regulatorni izvoz i podržani scenariji avansa/korekcija još nisu implementirani; razvojni zbir ostaje 21/32, sa 11 preostalih zadataka.

## Trajno stanje i pristup

Osamnaesta migracija `20261009120000_accounting_tax_evidence.sql` dodaje sedam relacija: verzije politike, profile, poništenja profila, događaje, izvorne stavke događaja, poništenja događaja i receipt-e zahteva. Nema JSON kolona za poslovno stanje. Pravila i izvori su vezani za [TAX-01 matricu](ACCOUNTING_TAX_RULES.md); server čuva verziju i hash-eve oba proverena propisa.

Svaki poslovni zapis pripada firmi i ima relacione veze po firmi. RLS koristi postojeći agencijski/firm pristup. Profil traži `manage_periods`; događaj `post_journal`; poništenje događaja i `reverse_journal`. Direktni upisi iz klijenta nisu dozvoljeni. Knjigovođa eksplicitno potvrđuje režim, važenje, poreski period i dokaz. DOO ne postaje PDV obveznik automatski.

Zapisi, poništenja i receipt-i su neizmenjivi. Komande zaključavaju firmu, proveravaju globalnu PDV reviziju, potvrđuju audit i receipt zajedno i vraćaju originalni odgovor pri ponavljanju istog zahteva. Promenjen payload sa istim ključem odbija se. Nepoznat ishod zadržava originalni payload/ključ i zaključava sve poslovne module i firmu/godinu do ponavljanja. Odbijen poznat zahtev zadržava unos.

Aktivni intervali profila ne smeju se preklapati. Poništenje neupotrebljenog profila ostavlja istoriju i dopušta ispravan novi profil. Profil sa istorijom događaja ne može biti poništen ili prepisan. Devetnaesta migracija `20261010100000_accounting_tax_profile_endings.sql` dodaje neizmenjivi datirani završetak: prvobitni interval ostaje u profilu, a posebna relacija čuva datum, razlog, autora i vreme završetka. `end_profile` zahteva `manage_periods`, globalnu reviziju i originalni idempotency ključ.

Završetak je uključiv: profil važi i na taj dan, naslednik može početi narednog dana ili kasnije. Datum mora biti u prvobitnom intervalu, strogo pre njegovog kraja, danas ili kasnije po serverskom datumu u zoni `Europe/Belgrade`. Ne sme preseći nijedan događaj tog profila, uključujući poništene događaje i druge poslovne godine. Jedan profil ima najviše jedan završetak; ni taj zapis ni završeni profil ne mogu biti poništeni ili prepisani. Zapisivanje događaja i kontrola preklapanja koriste stvarni završetak. Ponovljen originalni zahtev vraća prvi receipt i posle unosa naslednika.

Završetak i unos naslednika su dve odvojene potvrđene radnje. Pre unosa naslednika nepokriveni budući period ostaje vidljiv kroz odbijenu kontrolu, bez automatskog izbora režima. Novi status i period imaju zaseban dokaz. Promena usred meseca/tromesečja trenutno blokira izvoz tog perioda jer kontrola zahteva jedan profil za ceo interval; konsolidacija više režima unutar poreskog perioda ostaje otvorena. Nema automatskog prelaska režima, utvrđivanja pragova ili promene mesečnog/tromesečnog statusa.

## Poreski događaj iz potvrđenog izvora

Podržan je običan domaći RSD račun, kod kojeg je dobavljač poreski dužnik i datum prometa jednak datumu dokumenta. Izvor mora biti izdat, odobren, knjižen i nestorniran. Knjigovođa potvrđuje dokaz i odsustvo avansa. Server odbija avansne/korektivne dokumente, račun sa istorijom avansne raspodele, nepodržanu godinu/politiku i datume izvan profila ili otvorenog knjigovodstvenog perioda. Ne određuje datum prometa iz poslovne prirode računa.

Sve stavke izvora moraju biti obuhvaćene jednom, bez duplikata. Osnovica i PDV preuzimaju se sa servera, ne iz klijentskog iznosa. Server nezavisno ponavlja obračun 20%/10% ili proverava odsustvo PDV kod malog obveznika i zahteva jednakost sa izvornim iznosom. Posebna stopa traži važeću tačku člana 23 stav 2 i dokaz klasifikacije. Pravilo zaokruživanja je referentna interna politika TAX-01 i čeka poslovnu potvrdu.

Nabavke se podržavaju samo za redovnog PDV obveznika. Iznos odbitka je **izričita odluka knjigovođe sa dokazom**, uključujući odluku o nultom odbitku. Ne sme biti veći od PDV računa. Program ne autentifikuje dokument niti automatski potvrđuje zakonske uslove, vreme ostvarenja prava, srazmerni odbitak ili raspodelu troškova. Izlazna stavka nema odbitak.

Evidencija ne pravi novo knjiženje PDV ili novca. Poništenje događaja ostavlja razlog i istoriju, a ne stvara poresko smanjenje ili korektivni dokument. Dok postoji aktivan poreski događaj, baza blokira storno izvornog naloga i naknadnu raspodelu avansa. Posle poništenja može se evidentirati ispravna zamena ili posebno stornirati izvor; zatvoren izvorni period blokira poništenje. Ispravke za zatvoren period preko izmenjene prijave još nisu podržane.

## Kontrola perioda i Excel

Kontrola traži pun kalendarski mesec ili tromesečje prema jednom aktivnom profilu koji pokriva ceo interval. Za malog obveznika to je interna mesečna kontrola, bez prijave PDV. Pregled prikazuje izlazni PDV, ulazni PDV računa, izričito potvrđen odbitak i njihovu kontrolnu razliku. Ne naziva razliku konačnom poreskom obavezom.

Svi izdati nestornirani dokumenti godine dolaze iz potpunog serverskog upita. Nepokriveni računi, avansi i korektivni dokumenti ostaju vidljivi i **blokiraju izvoz**. Poništen poreski događaj ponovo otvara kontrolni nedostatak dok se ne evidentira zamena ili stornira izvor. Pre izvoza ponovo se čita i proverava serverski snimak. Upiti iznad deklarisanih limita (1000 profila/dokumenata, 10000 događaja) odbijaju se umesto tihog skraćivanja.

Excel ima četiri lista: `Kontrola`, `Dogadjaji`, `Istorija`, `Rezimi`. Sve ćelije su tekst, čuvaju velika tačna RSD sredstva i doslovne vrednosti koje počinju sa `=`. Izvoz sadrži firmu/godinu, interval, reviziju, verziju politike, ID izvora/stavke, dokaze i istoriju poništenja. `Rezimi` sadrži stvarni i prvobitni kraj profila, razlog završetka, autora i vreme. Označen je **INTERNA PDV KONTROLA — NIJE PORESKA PRIJAVA**.

Ovaj izvoz nije PPPDV/POPDV XML, SEF evidencija, dokaz podnošenja niti usaglašavanje svih samostalnih knjiženja na kontima PDV. [Ministarstvo finansija objavljuje važeći Pravilnik](https://www.mfin.gov.rs/sr/propisi-1/pravilnik-o-pdv-1); izbor obrasca mora pratiti njegove datirane odredbe, a ne datum preuzimanja fajla. Zakonske uslove odbitka proveriti prema [Zakonu o PDV](https://www.mfin.gov.rs/sr/propisi-1/zakon-o-porezu-na-dodatu-vrednost--21), ne prema izračunatom PDV na računu.

## Referentni scenariji i otvoreni razvoj

| Scenario | Rezultat |
| --- | --- |
| Prodaja 1000,00 / PDV 200,00 RSD | Potvrđen događaj bez dodatnog naloga |
| Nabavka 1000,00 / PDV 100,00, dokaz posebne stope i odbitka 50,00 | Ulazni PDV 100,00; potvrđen odbitak 50,00; kontrolna razlika uz prodaju 150,00 |
| Izgubljen odgovor posle upisa | Isti ključ i rezultat; jedan događaj i nepromenjena glavna knjiga |
| Nepokriven izdat dokument | Vidljiv nedostatak; izvoz odbijen |
| Nejednak PDV / nedostajući red / klasifikacija / prekoračen odbitak | Ceo zahtev odbijen bez delimičnih zapisa |
| Poništen događaj pa storniran izvor | Istorija sačuvana; izvor isključen iz aktivne kontrole |
| Zatvoren period / druga firma / čitalac koji upisuje | Upis odbijen |
| Preklopljeni režimi / poništenje već korišćenog profila | Odbijeno radi istorije |
| Korišćeni profil do 30.11, naslednik od 1.12 | Prvobitni interval sačuvan; novi događaj posle završetka ne može koristiti stari profil |
| Završetak pre kasnijeg poništenog događaja | Odbijen, istorija nije odsečena |
| Promena režima usred kontrolnog meseca | Izvoz tog meseca odbijen; ne sabira se prećutno nepotpun period |

Pre zatvaranja TAX-02 ostaju tri povezane celine: **datirani avansi i korekcije**, **odloženo/srazmerno pravo na odbitak i kontrola perioda sa više režima**, **regulatorni izvozi sa zvaničnim formatom, nezavisnom validacijom i kontrolom potpunosti/usaglašavanja**. Prospektivni završetak korišćenog profila i unos naslednika su implementirani. Poslovna potvrda TAX-01 i poreskih scenarija ostaje zaseban uslov prihvatanja. Sledeći razvoj nastavlja TAX-02; SEF je nakon tog zadatka.
