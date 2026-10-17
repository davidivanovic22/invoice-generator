# Knjiženje i raspodela deviznog bankarskog reda

Aktuelni blok završava sve 3 povezane tehničke celine: knjiženje uvezenog deviznog reda, raspodelu na više monetarnih stavki i izlazne naknade/neraspoređeni ostatak. Glavni status ostaje 14/32 završeno, 18 preostalo; FX-01 je IN_PROGRESS do šireg obuhvata, poslovne potvrde i svojih zavisnosti. Sledeći blok cilja 3 celine: devizne povraćaje, korekciju storniranog bankarskog izvora i kontrolu kontinuiteta izvoda.

Petnaesta opciona migracija je `20261009010000_accounting_fx_bank_posting.sql`. Ranije migracije se ne menjaju. Pet novih relacijskih tabela čuva bankarska knjiženja, raspodele, naknade, storna i receipt/hash potvrde. Settlement dobija nullable relacijski bankarski izvor; ranije ručne komande/receipt-i/izvodi i njihove veze ostaju važeći. Klijent prihvata i prethodne FX snimke bez novog polja.

## Knjiženje novca jednom

Uvoz i dalje ne knjiži. Korisnik otvara konkretan bankarski red i eksplicitno bira prelazni konto i sačuvani kurs sa dokazom. Bankarsko knjiženje koristi celu glavnicu tog reda, datum knjiženja iz banke, njegovu valutu i registrovano konto novca. Kurs se primenjuje jednom na ceo red, sa tačnim NUMERIC integer division/BigInt zaokruživanjem. Priliv knjiži novac duguje / prelazni konto potražuje; odliv obrnuto. Novo kontiranje je prikazano pre potvrde.

Postojeće ručno plaćanje sa istim računom/ID-jem, uključujući stornirano, blokira novi bankarski izvor. Ono se povezuje kroz raniji tok, bez novog naloga. Već knjižen ili storniran bankarski izvor ne može se ponovo kreirati. Direktni storno njegovog glavnog naloga je blokiran; koristi se namenski bankarski storno.

## Raspodela na više stavki

Jedan bankarski red može imati više uzastopnih raspodela, uključujući više partnera i monetarnih stavki. Svaka radnja je atomska: bankarska raspodela, FX settlement, nalog, dve revizije, audit i receipt potvrđuju se zajedno. Ceo niz raspodela nije jedna transakcija; nepotrošeni ostatak ostaje vidljiv između radnji. Paralelni zahtevi sa istom bankarskom revizijom imaju jednog pobednika.

Biraju se postojeće monetarne stavke iste valute i odgovarajućeg smera: priliv zatvara potraživanje, odliv obavezu. Proveravaju se firma, važeća revizija pozicije, preostala glavnica, period, datumi, konta i nezavisne promene analitike. Knjiženje raspodele koristi prelazni konto, analitiku partnera i, po potrebi, realizovanu kursnu razliku. Konto novca se ponovo ne knjiži.

RSD pokriće raspodele dolazi iz preostalog RSD pokrića banke: `round_half_up(preostalo_RSD × plaćeno_devizno / preostalo_devizno)`. Poslednja raspodela troši ceo RSD ostatak. Delimična radnja koja bi ostavila pozitivne devize bez RSD pokrića odbija se. RSD zatvorena vrednost FX stavke zasebno se raspodeljuje iz njene glavnice i knjigovodstvene vrednosti; razlika prema RSD pokriću banke ide na izabrano konto dobitka/gubitka prema smeru. Zato RSD pokriće jednog bankarskog dela može odstupiti za najmanju jedinicu od ponovnog nezavisnog kursiranja njegovog deviznog iznosa. Originalni kurs/proof i obe istorijske osnove ostaju sačuvani.

Raspodele imaju stvarni originalni broj računa i bankarski ID. Više raspodela razlikuje relacijski bankarski izvor i njihov nalog/ID, bez dodavanja izmišljenih sufiksa bankarskom ID-ju. Ručni tok i dalje ne dozvoljava ponovno korišćenje istog izvora. Direktan klijentski upis rezervacije raspodele ili izmena potvrđenih podataka nisu dozvoljeni.

## Naknada i ostatak

Za odlazni red može se izabrati devizni deo koji predstavlja naknadu i zasebno konto rashoda. Njegovo RSD pokriće se troši sa istog prelaznog konta; konto novca se ne knjiži ponovo. Moguće je knjižiti red koji sadrži samo naknadu ili red koji sadrži principal i naknadu. Iznos ne sme preći raspoloživi ostatak banke.

Provizija odbijena od priliva zahteva bruto potraživanje veće od primljenog novca i nije ovaj tok. Preostali devizni/RSD iznos ostaje na prelaznom kontu; to nije automatski partnerov avans, prihod ili dokaz da je račun plaćen. Dokumentni statusi se ne menjaju. Za računovodstvenu klasifikaciju ostatka potrebna je posebna poslovna radnja/potvrda.

## Storno i kontrola

Storno raspodele istovremeno vraća bankarsko devizno/RSD pokriće i FX glavnicu/knjigovodstvenu vrednost. Ako je pozicija kasnije vrednovana ili plaćena, prvo se stornira njen poslednji aktivni događaj. Raspodele različitih pozicija ne zahtevaju veštački globalni FX redosled. Datum bankarske radnje ne može ići unazad u odnosu na njenu istoriju. Izabrani period mora biti otvoren.

Bankarski storno raspodele proverava i aktuelnu reviziju FX pozicije. FX panel prikazuje da se bankarska raspodela stornira iz bankarskog panela; direktni FX storno bez bankarskog markera se odbija. Storno naknade vraća tačno njeno sačuvano pokriće. Storno celog bankarskog izvora traži da sve aktivne raspodele i naknade prethodno budu stornirane. Zapisi, nalozi i audit ostaju neizmenjiva istorija; source ID se ne reciklira.

Jedan serverski snimak sadrži bankarski red, izvor, raspodele, naknade, storna i FX pozicije. Klijent proverava istoriju obe valute, kapacitete, povezane settlement-e, revizije i tačan saldo prelaznog konta iz naloga pripisanih toj transakciji. To nije saldo celog konta, bankarsko početno stanje ili bankarska monetarna glavnica za vrednovanje. Pregled izvoda prikazuje samo preostali nepovezani deo aktivnog bankarskog reda; posle punog bankarskog storna ceo originalni red ponovo čeka usaglašavanje.

Neizvestan odgovor čuva isti payload i idempotency ključ, zaključava kontekst/izlazak i dopušta ponavljanje tog zahteva. Reader ima pregled bez komandnih kontrola. Revokacija dozvola važi i za replay. Bankarski radni pregled ima do 5000 zbirnih raspodela/naknada; FX pregled zadržava svoje ranije limite i odbija prekoračenje umesto tihe truncacije.

## Referentni primeri i preostale granice

| Primer | Očekivanje |
| --- | --- |
| Priliv 100 EUR po 120, raspodele 40 + 60 EUR, stavke po 117 | Novac 12000 RSD jednom; raspodele 4800/7200 RSD; realizovani prihodi 120/180 RSD; prelazni saldo 0 |
| Odliv 105 EUR po 120, obaveza 100 EUR po 117 i naknada 5 EUR | Novac 12600 RSD jednom; realizovani rashod 300 RSD; naknada 600 RSD; prelazni saldo 0 |
| Tri devizne najmanje jedinice po 1,5 RSD, tri raspodele po jednu | Banka 5 RSD najmanjih jedinica; pokrića 2 + 2 + 1, bez izmišljenog ostatka |
| Iznos preko JS Number preciznosti, raspodela sve osim jedne jedinice, zatim poslednja | Tačno preostalo 1, zatim 0 u obe valute |
| Kasnije FX vrednovanje, pokušaj bankarskog storna ranije raspodele | Cela radnja odbijena; nema delimičnog markera ili promene salda |
| Storno dve raspodele i izvora | Obe pozicije vraćene, saldo novca/prelaznog izvora vraćen stornom, istorija sačuvana |
| Prekid posle upisa ili dva zahteva sa istom revizijom | Replay istog receipt-a ili jedan pobednik; bez dodatnog kontiranja novca |

Devizni povraćaji, bruto priliv sa odbijenom provizijom, kursiranje bankarske devizne glavnice, korekcija/reknjiženje storniranog bankarskog ID-ja, puna kontrola kontinuiteta izvoda i poslovna potvrda kontiranja ostaju otvoreni. Regulatorni moduli, staging/Storage/Auth i poslovne zavisnosti ostaju u glavnom backlogu. Produkcija i originalna poslovna baza nisu migrirane.

## Izvršene provere

Svih 53 unit grupa / 314 testova, TypeScript i završni build prolaze. Legacy i svih 15 migracija sa SQL proverama prolaze na izolovanoj bazi `paperwork_relational_1791495810`; runner je nakon privremene Docker servisne greške nastavljen od prekinutog payment testa. Sve tri obnove čuvaju 112 otisaka tabela/sekvenci, metapodatke, bankarsko/FX pokriće i originalni receipt replay bez drugog knjiženja novca.

Završni puni browser skup prolazi na obnovljenoj bazi `paperwork_relational_1791532881810912400`, uključujući Excel priliv 40 + 60 EUR, odliv 100 + 5 EUR, stvarne D/P potvrde, neizvestan odgovor i identičan retry ključ, blokiran kontekst i storno zavisnosti. Identifikatori kopija i detalji nastavka su u [dvadesetoj implementacionoj celini](ACCOUNTING_BACKLOG.md). Udaljeni CI nije izvršen.
