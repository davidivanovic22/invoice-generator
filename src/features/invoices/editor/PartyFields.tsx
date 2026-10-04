import { useState, type ReactNode } from 'react';
import { t } from '../../../i18n';
import { TextField } from '../../../ui/Field';
import { MoreToggle } from '../../../ui/Layout';
import type { Party } from '../model';

type Props = {
  party: Party;
  onChange: (party: Party) => void;
  /** Replaces the plain name input, e.g. with the client search. */
  nameSlot?: ReactNode;
  showEmail?: boolean;
};

export const PartyFields = ({ party, onChange, nameSlot, showEmail = true }: Props) => {
  const set = (field: keyof Party) => (value: string) => onChange({ ...party, [field]: value });
  const [more, setMore] = useState(Boolean(party.regNo || party.email || party.taxIdLabel || party.regIdLabel));
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        {nameSlot ?? <TextField label={t('Name or company')} value={party.name} onChange={set('name')} placeholder="Acme d.o.o." autoComplete="organization" />}
      </div>
      <TextField wrapperClassName="col-span-2" label={t('Street address')} value={party.address} onChange={set('address')} placeholder="Knez Mihailova 1" autoComplete="street-address" />
      <TextField label={t('City and country')} value={party.cityCountry} onChange={set('cityCountry')} placeholder="11000 Beograd, Srbija" />
      <TextField label={party.taxIdLabel || t('Tax ID (PIB / VAT)')} value={party.taxId} onChange={set('taxId')} placeholder="123456789" inputMode="numeric" />
      <div className="col-span-2">
        <MoreToggle open={more} onToggle={() => setMore((value) => !value)} label={t('Registration number, email and more')} />
      </div>
      {more && (
        <>
          <TextField label={party.regIdLabel || t('Company reg. no. (MB)')} value={party.regNo} onChange={set('regNo')} placeholder="12345678" inputMode="numeric" />
          {showEmail && <TextField type="email" label={t('Email')} value={party.email} onChange={set('email')} placeholder="billing@acme.com" />}
          <TextField label={t('Label for tax ID')} hint={t('e.g. OIB for Croatia, VAT for the EU')} value={party.taxIdLabel} onChange={set('taxIdLabel')} placeholder={t('Tax ID')} />
          <TextField label={t('Label for reg. no.')} value={party.regIdLabel} onChange={set('regIdLabel')} placeholder={t('Reg. no.')} />
        </>
      )}
    </div>
  );
};
