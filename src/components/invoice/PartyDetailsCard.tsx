import type { PartyDetails } from '../../types/invoice';

type Props = {
  title: string;
  party: PartyDetails;
  showIban?: boolean;
};

export const PartyDetailsCard = ({ title, party, showIban = false }: Props) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:p-3">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>

      <div className="space-y-1 text-sm leading-6 text-slate-700">
        <div className="font-semibold text-slate-900">{party.name}</div>
        <div>{party.address}</div>
        <div>{party.cityCountry}</div>
        <div>
          {party.taxIdLabel}: {party.taxIdValue}
        </div>
        <div>
          {party.regIdLabel}: {party.regIdValue}
        </div>
        {showIban ? <div>IBAN: {party.iban}</div> : null}
      </div>
    </div>
  );
};