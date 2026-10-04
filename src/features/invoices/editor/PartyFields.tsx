import type { ReactNode } from 'react';
import { TextField } from '../../../ui/Field';
import type { Party } from '../model';

type Props = {
  party: Party;
  onChange: (party: Party) => void;
  /** Shown above the name field instead of a plain input, e.g. the client search. */
  nameSlot?: ReactNode;
  showEmail?: boolean;
};

export const PartyFields = ({ party, onChange, nameSlot, showEmail = true }: Props) => {
  const set = (field: keyof Party) => (value: string) => onChange({ ...party, [field]: value });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        {nameSlot ?? <TextField label="Name or company" value={party.name} onChange={set('name')} placeholder="Acme d.o.o." />}
      </div>
      <TextField wrapperClassName="col-span-2" label="Street address" value={party.address} onChange={set('address')} placeholder="Knez Mihailova 1" />
      <TextField wrapperClassName="col-span-2" label="City, postcode, country" value={party.cityCountry} onChange={set('cityCountry')} placeholder="11000 Beograd, Srbija" />
      <TextField label={party.taxIdLabel || 'Tax ID (PIB / VAT)'} value={party.taxId} onChange={set('taxId')} placeholder="123456789" />
      <TextField label={party.regIdLabel || 'Company reg. no. (MB)'} value={party.regNo} onChange={set('regNo')} placeholder="12345678" />
      {showEmail && (
        <TextField wrapperClassName="col-span-2" type="email" label="Email" value={party.email} onChange={set('email')} placeholder="billing@acme.com" />
      )}
    </div>
  );
};
