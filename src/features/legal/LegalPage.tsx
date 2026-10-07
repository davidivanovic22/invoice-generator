import { Link } from 'react-router-dom';
import { getLang } from '../../i18n';

type Section = { title: string; body: string[] };
type Doc = { title: string; updated: string; intro: string; sections: Section[] };

// Plain-language drafts. Have them reviewed by a lawyer before offering the app to customers.
const PRIVACY: Record<'sr' | 'en', Doc> = {
  sr: {
    title: 'Politika privatnosti',
    updated: 'Poslednja izmena: 5. oktobar 2026.',
    intro: 'Paperwork je napravljen tako da tvoji podaci ostanu tvoji. Ovde piše koje podatke aplikacija koristi, gde se čuvaju i ko ih vidi.',
    sections: [
      {
        title: 'Gde se čuvaju podaci',
        body: [
          'Bez povezane baze, sve (fakture, klijenti, KPO knjiga, CV, backup-ovi) čuva se samo u tvom pregledaču, na tvom uređaju. Mi ih ne vidimo i ne šaljemo nikome.',
          'Ako povežeš bazu (Supabase), podaci firmi i CV se čuvaju i u toj bazi, na serveru koji izabereš (preporuka: EU). Pristup štiti prijava i pravila u bazi: svaki nalog vidi samo firme u kojima je član.'
        ]
      },
      {
        title: 'Koje podatke obrađujemo',
        body: [
          'Podatke koje sam uneseš: podatke o firmi (naziv, adresa, PIB, matični broj, račun), klijente, fakture, KPO unose, porez i sadržaj CV-a.',
          'Ako koristiš sinhronizaciju: email adresu naloga i istoriju izmena (ko je i kada menjao podatke firme).',
          'Ne koristimo kolačiće za praćenje, oglase ni analitiku.'
        ]
      },
      {
        title: 'Spoljni servisi',
        body: [
          'Kurs NBS se preuzima sa javnog servisa kurs.resenje.org (šalje se samo valuta i datum).',
          'AI funkcije šalju tekst CV-a i oglasa servisu Eden AI i izabranom modelu (OpenAI). PDF uvoz šalje fajl Affinda parseru preko Eden AI. Pozivi se izvršavaju samo kad ih pokreneš, uz tvoj API ključ.',
          'Slanje mejla otvara tvoj Gmail ili mejl aplikaciju; aplikacija sama ne šalje mejlove.'
        ]
      },
      {
        title: 'Tvoja prava',
        body: [
          'U svakom trenutku možeš da preuzmeš sve podatke (Nalog i backup → Preuzmi backup fajl), da ih ispraviš ili obrišeš.',
          'Brisanjem podataka pregledača brišu se lokalni podaci; podatke u bazi briše vlasnik firme ili brisanjem naloga.',
          'Za pitanja o zaštiti podataka o ličnosti piši na adresu navedenu na stranici aplikacije.'
        ]
      }
    ]
  },
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: 5 October 2026',
    intro: 'Paperwork is built so your data stays yours. This page explains what the app uses, where it is stored and who can see it.',
    sections: [
      {
        title: 'Where data is stored',
        body: [
          'Without a connected database, everything (invoices, clients, KPO book, resumes, backups) stays in your browser on your device. We cannot see it and send it nowhere.',
          'If you connect a database (Supabase), firm data and resumes are also stored there, in the region you choose (EU recommended). Access is protected by sign-in and database rules: each account only sees firms it is a member of.'
        ]
      },
      {
        title: 'What we process',
        body: [
          'What you enter: business details (name, address, tax ID, registration number, bank account), clients, invoices, KPO entries, taxes and resume content.',
          'With sync: your account email and the history of changes (who changed a firm’s data and when).',
          'No tracking cookies, ads or analytics.'
        ]
      },
      {
        title: 'Third-party services',
        body: [
          'NBS exchange rates come from the public kurs.resenje.org service (only currency and date are sent).',
          'AI features send resume and job-ad text to Eden AI and its selected model provider (OpenAI). PDF resume import sends the file to Affinda through Eden AI. These requests run only when you start them, using your API key.',
          'Sending email opens your Gmail or mail app; the app itself does not send email.'
        ]
      },
      {
        title: 'Your rights',
        body: [
          'You can download all data at any time (Account & backup → Download backup file), correct it or delete it.',
          'Clearing browser data removes local data; data in the database is deleted by the firm owner or by deleting the account.',
          'For data-protection questions, write to the address shown on the app’s website.'
        ]
      }
    ]
  }
};

const TERMS: Record<'sr' | 'en', Doc> = {
  sr: {
    title: 'Uslovi korišćenja',
    updated: 'Poslednja izmena: 5. oktobar 2026.',
    intro: 'Korišćenjem aplikacije prihvataš ove uslove.',
    sections: [
      {
        title: 'Šta aplikacija radi',
        body: [
          'Paperwork pomaže da napraviš fakture, vodiš KPO knjigu, pratiš prihod, porez i limite, i napraviš CV.',
          'Proračuni (kurs, limiti, porez) su pomoć, a ne poreski ili pravni savet. Za prijave i rokove proveri iznose sa knjigovođom.',
          'Fakture firmama u Srbiji izdaju se kroz SEF; ova aplikacija ne šalje fakture u SEF.'
        ]
      },
      {
        title: 'Tvoja odgovornost',
        body: [
          'Odgovoran si za tačnost podataka koje uneseš i za fakture koje izdaš.',
          'Redovno pravi backup (aplikacija to radi automatski u pregledaču; preporučujemo i backup u folder ili povezivanje baze).',
          'Kad pozoveš nekoga u firmu, ta osoba vidi podatke te firme u skladu sa ulogom koju joj daš.'
        ]
      },
      {
        title: 'Dostupnost i izmene',
        body: [
          'Aplikacija se pruža „kakva jeste“. Trudimo se da radi bez prekida, ali ne garantujemo neprekidan rad spoljnih servisa (baza, kurs, AI).',
          'Uslove možemo da menjamo; o bitnim izmenama obaveštavamo u aplikaciji.'
        ]
      }
    ]
  },
  en: {
    title: 'Terms of use',
    updated: 'Last updated: 5 October 2026',
    intro: 'By using the app you accept these terms.',
    sections: [
      {
        title: 'What the app does',
        body: [
          'Paperwork helps you create invoices, keep the KPO book, track income, tax and limits, and build resumes.',
          'Calculations (rates, limits, tax) are a help, not tax or legal advice. Check filings and deadlines with your accountant.',
          'Invoices to businesses in Serbia are issued through SEF; this app does not send invoices to SEF.'
        ]
      },
      {
        title: 'Your responsibility',
        body: [
          'You are responsible for the accuracy of the data you enter and the invoices you issue.',
          'Keep backups (the app makes them automatically in the browser; a backup folder or a connected database is recommended too).',
          'When you invite someone to a firm, they see that firm’s data according to the role you give them.'
        ]
      },
      {
        title: 'Availability and changes',
        body: [
          'The app is provided “as is”. We aim for it to work without interruption but cannot guarantee third-party services (database, rates, AI).',
          'We may change these terms and will announce important changes in the app.'
        ]
      }
    ]
  }
};

export const LegalPage = ({ kind }: { kind: 'privacy' | 'terms' }) => {
  const doc = (kind === 'privacy' ? PRIVACY : TERMS)[getLang() === 'sr' ? 'sr' : 'en'];
  const other = kind === 'privacy' ? { to: '/terms', label: getLang() === 'sr' ? 'Uslovi korišćenja' : 'Terms of use' } : { to: '/privacy', label: getLang() === 'sr' ? 'Politika privatnosti' : 'Privacy policy' };
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{doc.title}</h1>
      <p className="mt-1 text-sm text-slate-400">{doc.updated}</p>
      <p className="mt-5 text-slate-700">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
            {section.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-sm">
        <Link to={other.to} className="font-medium text-indigo-600 hover:underline">
          {other.label} →
        </Link>
      </p>
    </div>
  );
};
