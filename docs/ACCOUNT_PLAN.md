# Plan prijave i rada više korisnika

Status: plan zasnovan na pregledu koda i produkcijskih podešavanja 7. oktobra 2026. Implementirana je posebna `/login` stranica: odjavljeni korisnici nemaju pristup prikazu firmi i dokumenata, a odjava vodi na prijavu. U režimu sa bazom isključeno je dodatno zaključavanje browsera. Preostali koraci plana nisu time završeni.

## Šta već postoji

- Produkcija dozvoljava registraciju i prijavu emailom; potvrda emaila je uključena, anonimna prijava isključena.
- `src/lib/cloud.ts` podržava registraciju, email + lozinku, prijavu linkom iz emaila i trajnu sesiju sa automatskim obnavljanjem.
- Firma ima vlasnika, knjigovođu ili čitaoca. Pristup određuju članstva i pravila u bazi. Jedan nalog može imati pristup više firmi; CV pripada nalogu.
- Vlasnik može dodeliti pristup postojećoj firmi. Trenutno dugme za pozivanje upisuje poziv u bazu; ne šalje samo po sebi email obaveštenje.
- Kreiranje firme je eksplicitno i PIB je jedinstven. Prijava, registracija i refresh ne smeju praviti firme ili uvoziti podatke browsera.

## Zašto sada deluje kao dve prijave

`AccountGate.tsx` prvo traži lozinku lokalnog zaključavanja browsera. To nije Supabase nalog i ne potvrđuje identitet korisnika u bazi. Tek odeljak `CloudSection.tsx` nudi pravu prijavu emailom i lozinkom ili email linkom. Lokalno zaključavanje može i da spreči pokretanje učitavanja baze dok se ne otključa.

Za aplikaciju koja koristi bazu preporuka je jedna prijava na nalog. Posebno lokalno zaključavanje može ostati dostupno samo u samostalnom režimu bez baze.

## Preporučeni tok

1. Otvaranje aplikacije proverava postojeću sesiju. Dok provera traje prikazuje se učitavanje, zatim prijava ili podaci naloga.
2. Bez sesije: jedna forma za email + lozinku, registraciju, oporavak lozinke i alternativnu prijavu linkom iz emaila.
3. Sa važećom sesijom: nema dodatnog unosa emaila ili lozinke. Email se prikazuje iz naloga. Čuvanje i učitavanje koriste istu sesiju.
4. Bez postavljene lozinke: prijava linkom iz emaila; postavljanje lozinke je opciono. Sam unos poznatog emaila ne daje pristup. Ako sesija istekne, potreban je ponovo potvrđen identitet kroz lozinku ili email link.
5. Novi nalog bez firmi dobija prazan ekran sa izborom da ručno napravi firmu ili otvori firmu kojoj je dobio pristup. Nema probnih ili automatski napravljenih firmi.
6. Knjigovođa koristi svoj nalog. Vlasnik mu dodeljuje pristup firmi; knjigovođa zatim može otvoriti više dozvoljenih firmi. Novi korisnik nema pristup tuđim podacima samo zato što se registrovao.

## Šta menjati u aplikaciji

1. U režimu sa bazom zameniti lokalni password gate pravom prijavom. Postojeće naloge i sesije zadržati; ne postavljati ili menjati korisničke lozinke automatski.
2. Odeljak „Cloud sync“ zameniti odeljkom „Nalog“: trenutni email, postavljanje/promena lozinke, oporavak i odjava. Podatke Supabase projekta zadržati u konfiguraciji aplikacije, izvan toka za obične korisnike.
3. Ukloniti zasebno dugme „Sync now“ i nepotrebne opcije izbora lokalnih/cloud dokumenata iz režima sa bazom. Veza sa bazom, automatsko čuvanje, učitavanje novijih promena i zaštita od zastarelih upisa ostaju potrebni. Korisnik vidi kratke statuse „Čuvanje“, „Sačuvano“ i jasno upozorenje kada čuvanje ne uspe.
4. Backup i ručni import ostaju posebne eksplicitne radnje. Import potvrđuje postojeću ciljnu firmu i ne kreira firme.
5. Pozivi za pristup ostaju vezani za email naloga i ulogu. Ako treba email obaveštenje o pozivu, dodati slanje na serveru; postojeći upis poziva nije email dostava.

## Provere pre upotrebe sa drugim ljudima

- Proveriti produkcijsko slanje emaila, dozvoljene povratne adrese i tok potvrde/oporavka. Javni Auth settings potvrđuje da je email prijava uključena, ali ne potvrđuje dostavu drugim adresama. CLI pregled nije potvrdio custom SMTP podešavanje. Supabase podrazumevani SMTP ograničava slanje na adrese članova projektnog tima, pa za druge korisnike treba potvrditi odgovarajuću konfiguraciju dostave.
- Testirati dva odvojena vlasnika: međusobno ne vide firme, klijente, fakture, KPO ili CV.
- Testirati knjigovođu sa pristupom više firmi i čitaoca koji ne može pisati. Uklanjanje članstva mora ukinuti dalji pristup.
- Testirati prijavu/odjavu i promenu naloga u istom browseru, refresh, postojeću sesiju, nalog bez lozinke i oporavak. Ne sme ostati prethodni prikaz podataka drugog naloga.
- Testirati istovremene izmene i prekid veze: neuspešno čuvanje mora biti vidljivo, zastarela revizija ne sme pregaziti noviju.
- Broj firmi mora ostati isti posle registracije, prijave i ponovljenog refresha; menja se samo eksplicitnim kreiranjem ili brisanjem.

## Izvori

- [Supabase: email i lozinka](https://supabase.com/docs/guides/auth/passwords)
- [Supabase: prijava bez lozinke](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase: sesije](https://supabase.com/docs/guides/auth/sessions)
- [Supabase: produkcijska dostava emaila](https://supabase.com/docs/guides/auth/auth-smtp)
