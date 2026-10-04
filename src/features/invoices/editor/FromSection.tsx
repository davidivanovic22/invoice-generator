import { Link } from 'react-router-dom';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/Field';
import { Section } from '../../../ui/Layout';
import type { BankDetails, BusinessProfile, Invoice, Party } from '../model';
import { PartyFields } from './PartyFields';

type Props = {
  invoice: Invoice;
  profile: BusinessProfile;
  onChange: (update: Partial<Invoice>) => void;
};

const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export const FromSection = ({ invoice, profile, onChange }: Props) => {
  const differsFromProfile = !same(invoice.issuer, profile.party) || !same(invoice.bank, profile.bank);
  const setBank = (field: keyof BankDetails) => (value: string) => onChange({ bank: { ...invoice.bank, [field]: value } });
  const isEmpty = !invoice.issuer.name.trim();

  return (
    <Section
      id="from"
      title="From"
      icon="building"
      description={invoice.issuer.name || 'Your business details'}
      collapsible
      defaultOpen={isEmpty}
    >
      <p className="mb-4 text-[13px] text-slate-500">
        Filled in from your{' '}
        <Link to="/profile" className="font-medium text-indigo-600 hover:underline">
          business profile
        </Link>
        . Changes here apply to this invoice only.
      </p>
      <PartyFields party={invoice.issuer} onChange={(issuer: Party) => onChange({ issuer })} />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <TextField wrapperClassName="col-span-2" label="IBAN / account number" value={invoice.bank.iban} onChange={setBank('iban')} placeholder="RS35 1050 0812 3123 1231 23" />
        <TextField label="SWIFT / BIC" value={invoice.bank.swift} onChange={setBank('swift')} />
        <TextField label="Bank" value={invoice.bank.bankName} onChange={setBank('bankName')} />
      </div>
      {differsFromProfile && profile.party.name && (
        <Button size="sm" className="mt-4" icon="refresh" onClick={() => onChange({ issuer: { ...profile.party }, bank: { ...profile.bank } })}>
          Reset to business profile
        </Button>
      )}
    </Section>
  );
};
