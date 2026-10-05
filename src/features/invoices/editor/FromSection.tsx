import { Link } from 'react-router-dom';
import { t } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/Field';
import { ImagePicker, SignaturePad } from '../../../ui/ImageInputs';
import { Section } from '../../../ui/Layout';
import type { BankDetails, BusinessProfile, Invoice, Party } from '../model';
import { PartyFields } from './PartyFields';

type Props = {
  invoice: Invoice;
  profile: BusinessProfile;
  onChange: (update: Partial<Invoice>) => void;
  /** Logo and signature belong to the business profile, so every invoice gets them. */
  onProfileChange: (update: Partial<BusinessProfile>) => void;
  forceOpenToken?: number;
};

const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export const FromSection = ({ invoice, profile, onChange, onProfileChange, forceOpenToken }: Props) => {
  const differsFromProfile = !same(invoice.issuer, profile.party) || !same(invoice.bank, profile.bank);
  const setBank = (field: keyof BankDetails) => (value: string) => onChange({ bank: { ...invoice.bank, [field]: value } });
  const isEmpty = !invoice.issuer.name.trim();

  return (
    <Section
      id="from"
      title={t('From (your business)')}
      icon="building"
      description={invoice.issuer.name || t('Your business details')}
      collapsible
      defaultOpen={isEmpty}
      forceOpenToken={forceOpenToken}
    >
      <p className="mb-4 text-[13px] text-slate-500">
        {t('Filled in from your')}{' '}
        <Link to="/profile" className="font-medium text-indigo-600 hover:underline">
          {t('business profile')}
        </Link>
        . {t('Changes here apply to this invoice only.')}
      </p>
      <PartyFields party={invoice.issuer} onChange={(issuer: Party) => onChange({ issuer })} ownBusiness />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <TextField wrapperClassName="col-span-2" label={t('IBAN / account number')} value={invoice.bank.iban} onChange={setBank('iban')} placeholder="RS35 1050 0812 3123 1231 23" />
        <TextField label="SWIFT / BIC" value={invoice.bank.swift} onChange={setBank('swift')} />
        <TextField label={t('Bank')} value={invoice.bank.bankName} onChange={setBank('bankName')} />
      </div>
      <div className="mt-5 space-y-5 border-t border-slate-100 pt-4">
        <ImagePicker label={t('Logo')} value={profile.logo} onChange={(logo) => onProfileChange({ logo })} hint={t('Used on all your invoices.')} />
        <SignaturePad value={profile.signature} onChange={(signature) => onProfileChange({ signature })} />
      </div>
      {differsFromProfile && profile.party.name && (
        <Button size="sm" className="mt-4" icon="refresh" onClick={() => onChange({ issuer: { ...profile.party }, bank: { ...profile.bank } })}>
          {t('Reset to business profile')}
        </Button>
      )}
    </Section>
  );
};
