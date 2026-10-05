import { useEffect, useState } from 'react';
import { t } from '../../../i18n';
import { formatAmount } from '../../../lib/money';
import { Button } from '../../../ui/Button';
import { NumberField } from '../../../ui/Field';
import { Segmented } from '../../../ui/Layout';
import { monthsSoFar, taxSpentEur, type YearTax } from '../model';

type Props = {
  year: number;
  value: YearTax | undefined;
  onSave: (tax: YearTax | undefined) => void;
  onClose: () => void;
};

/** Enter the fixed monthly tax for one year. */
export const YearTaxDialog = ({ year, value, onSave, onClose }: Props) => {
  const [monthly, setMonthly] = useState(value?.monthly ?? 0);
  const [currency, setCurrency] = useState<'EUR' | 'RSD'>(value?.currency ?? 'EUR');
  const [rsdPerEur, setRsdPerEur] = useState(value?.rsdPerEur ?? 117.2);
  const draft: YearTax = { monthly, currency, rsdPerEur };
  const months = monthsSoFar(year);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="year-tax-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="year-tax-title" className="text-lg font-semibold text-slate-900">
          {t('Tax for {year}', { year })}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('Enter the fixed monthly amount you pay this year (e.g. the flat-rate tax).')}</p>

        <div className="mt-5 space-y-4">
          <div className="flex items-end gap-3">
            <NumberField label={t('Per month')} value={monthly} onChange={setMonthly} min={0} suffix={currency} wrapperClassName="flex-1" autoFocus />
            <Segmented<'EUR' | 'RSD'>
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'EUR', label: 'EUR' },
                { value: 'RSD', label: 'RSD' }
              ]}
            />
          </div>
          {currency === 'RSD' && (
            <NumberField label={t('Exchange rate (RSD for 1 EUR)')} value={rsdPerEur} onChange={(rate) => rate > 0 && setRsdPerEur(rate)} min={1} hint={t('Used to show the amounts in euros.')} />
          )}
          {monthly > 0 && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {t('So far in {year}: {months} × {monthly} = {total}', {
                year,
                months,
                monthly: formatAmount(monthly, currency),
                total: formatAmount(taxSpentEur(draft, year), 'EUR')
              })}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {value ? (
            <Button
              variant="danger"
              onClick={() => {
                onSave(undefined);
                onClose();
              }}
            >
              {t('Remove')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>{t('Cancel')}</Button>
            <Button
              variant="accent"
              disabled={monthly <= 0}
              onClick={() => {
                onSave(draft);
                onClose();
              }}
            >
              {t('Save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
