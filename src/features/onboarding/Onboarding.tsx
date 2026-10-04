import { useState } from 'react';
import { hasChosenLanguage, t, useLanguage } from '../../i18n';
import { Button } from '../../ui/Button';
import { SelectField, TextField } from '../../ui/Field';
import { Icon, type IconName } from '../../ui/Icon';
import { QuickInvoiceDialog } from '../invoices/QuickInvoiceDialog';
import { createParty, type Party } from '../invoices/model';
import { useInvoiceStore } from '../invoices/store';
import { NewResumeDialog } from '../resumes/NewResumeDialog';
import { useResumeStore } from '../resumes/store';

const DONE_KEY = 'studio.onboarded';

const isDone = () => {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
};

const markDone = () => {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // Without storage the welcome simply shows again next time.
  }
};

type Step = 'language' | 'goal' | 'business' | 'next-invoice' | 'next-resume';

const Choice = ({ icon, title, text, onClick }: { icon: IconName; title: string; text: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-2xl p-4 text-left ring-1 ring-slate-200 transition hover:bg-indigo-50/50 hover:ring-indigo-300">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
      <Icon name={icon} className="h-6 w-6" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-sm text-slate-500">{text}</span>
    </span>
    <Icon name="chevronRight" className="h-5 w-5 text-slate-300" />
  </button>
);

/** First-run welcome: language, goal, and (for invoices) business details, all skippable. */
export const Onboarding = () => {
  const { store: invoiceStore, updateProfile } = useInvoiceStore();
  const { store: resumeStore } = useResumeStore();
  const { lang, setLang } = useLanguage();
  const hasData = invoiceStore.invoices.length > 0 || resumeStore.resumes.length > 0 || Boolean(invoiceStore.profile.party.name);
  const [visible, setVisible] = useState(() => {
    if (isDone()) return false;
    if (hasData) {
      markDone();
      return false;
    }
    return true;
  });
  // The app re-mounts after a language change; resume where the user was.
  const [step, setStep] = useState<Step>(() => (hasChosenLanguage() ? 'goal' : 'language'));
  const [party, setParty] = useState<Party>(createParty());
  const [iban, setIban] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [noVat, setNoVat] = useState(true);

  if (!visible) return null;

  const finish = () => {
    markDone();
    setVisible(false);
  };

  if (step === 'next-invoice') return <QuickInvoiceDialog onClose={finish} />;
  if (step === 'next-resume') return <NewResumeDialog onClose={finish} />;

  const saveBusiness = () => {
    updateProfile((profile) => ({
      ...profile,
      party: { ...profile.party, ...party },
      bank: { ...profile.bank, iban: iban.trim() },
      defaults: {
        ...profile.defaults,
        currency,
        language: lang === 'sr' ? 'sr' : 'en',
        note: noVat ? (lang === 'sr' ? 'Obveznik nije u sistemu PDV-a.' : 'The issuer is not registered for VAT.') : profile.defaults.note
      }
    }));
    markDone();
    setStep('next-invoice');
  };

  const set = (field: keyof Party) => (value: string) => setParty((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <Icon name="file" className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-lg font-semibold text-slate-900">Paperwork</span>
        </div>

        {step === 'language' && (
          <>
            <h2 id="onboarding-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Dobrodošli · Welcome
            </h2>
            <p className="mt-1 text-slate-500">Izaberite jezik · Choose your language</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(['sr', 'en'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (value === lang) setStep('goal');
                    setLang(value);
                  }}
                  className="rounded-2xl p-5 text-left ring-1 ring-slate-200 transition hover:bg-indigo-50/50 hover:ring-indigo-300"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700" aria-hidden="true">
                    {value === 'sr' ? 'SR' : 'EN'}
                  </span>
                  <span className="mt-3 block text-lg font-semibold text-slate-900">{value === 'sr' ? 'Srpski' : 'English'}</span>
                  <span className="block text-sm text-slate-500">{value === 'sr' ? 'Latinica' : 'International'}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'goal' && (
          <>
            <h2 id="onboarding-title" className="text-2xl font-bold tracking-tight text-slate-900">
              {t('What would you like to make first?')}
            </h2>
            <p className="mt-1 text-slate-500">{t('You can do both later. Nothing leaves your browser.')}</p>
            <div className="mt-6 grid gap-3">
              <Choice icon="file" title={t('An invoice')} text={t('Set up your business once, then every invoice takes seconds.')} onClick={() => setStep('business')} />
              <Choice icon="user" title={t('A resume')} text={t('Upload your current CV or start from a great example.')} onClick={() => setStep('next-resume')} />
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep('language')}>
                {t('Back')}
              </Button>
              <Button variant="ghost" onClick={finish}>
                {t('Just look around')}
              </Button>
            </div>
          </>
        )}

        {step === 'business' && (
          <>
            <h2 id="onboarding-title" className="text-2xl font-bold tracking-tight text-slate-900">
              {t('Your business, once')}
            </h2>
            <p className="mt-1 text-slate-500">{t('These details appear on every invoice. You can change them any time.')}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <TextField wrapperClassName="col-span-2" label={t('Name or company')} value={party.name} onChange={set('name')} placeholder={t('e.g. Marko Petrović PR')} autoFocus />
              <TextField wrapperClassName="col-span-2" label={t('Street address')} value={party.address} onChange={set('address')} placeholder="Knez Mihailova 1" />
              <TextField label={t('City and country')} value={party.cityCountry} onChange={set('cityCountry')} placeholder="11000 Beograd, Srbija" />
              <TextField label={t('Tax ID (PIB / VAT)')} value={party.taxId} onChange={set('taxId')} placeholder="123456789" inputMode="numeric" />
              <TextField label={t('IBAN / account number')} value={iban} onChange={setIban} placeholder="RS35 1050 0812 3123 1231 23" />
              <SelectField
                label={t('Usual currency')}
                value={currency}
                onChange={setCurrency}
                options={['EUR', 'RSD', 'USD', 'GBP', 'CHF'].map((code) => ({ value: code, label: code }))}
              />
              <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={noVat} onChange={(event) => setNoVat(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                {t('I am not registered for VAT (adds the usual note to invoices)')}
              </label>
            </div>
            <div className="mt-6 flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep('next-invoice')}>
                {t('Skip for now')}
              </Button>
              <Button variant="accent" size="lg" iconRight="chevronRight" onClick={saveBusiness} disabled={!party.name.trim()}>
                {t('Save and create an invoice')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
