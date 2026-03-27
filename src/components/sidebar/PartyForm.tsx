import type { PartyDetails } from '../../types/invoice';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { SectionTitle } from '../common/SectionTitle';

type Props = {
  title: string;
  party: PartyDetails;
  onChange: (field: keyof PartyDetails, value: string) => void;
  showIban?: boolean;
};

export const PartyForm = ({
  title,
  party,
  onChange,
  showIban = false
}: Props) => {
  return (
    <Card>
      <SectionTitle title={title} />

      <div className="space-y-3">
        <Input label="Name" value={party.name} onChange={(e) => onChange('name', e.target.value)} />
        <Input
          label="Address"
          value={party.address}
          onChange={(e) => onChange('address', e.target.value)}
        />
        <Input
          label="City / Country"
          value={party.cityCountry}
          onChange={(e) => onChange('cityCountry', e.target.value)}
        />
        <Input
          label="Tax label"
          value={party.taxIdLabel}
          onChange={(e) => onChange('taxIdLabel', e.target.value)}
        />
        <Input
          label="Tax value"
          value={party.taxIdValue}
          onChange={(e) => onChange('taxIdValue', e.target.value)}
        />
        <Input
          label="Registration label"
          value={party.regIdLabel}
          onChange={(e) => onChange('regIdLabel', e.target.value)}
        />
        <Input
          label="Registration value"
          value={party.regIdValue}
          onChange={(e) => onChange('regIdValue', e.target.value)}
        />
        {showIban ? (
          <Input
            label="IBAN"
            value={party.iban ?? ''}
            onChange={(e) => onChange('iban', e.target.value)}
          />
        ) : null}
      </div>
    </Card>
  );
};