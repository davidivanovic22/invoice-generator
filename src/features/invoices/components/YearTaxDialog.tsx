import { useEffect, useState } from 'react';
import { t, uiLocale } from '../../../i18n';
import { formatAmount } from '../../../lib/money';
import { Button } from '../../../ui/Button';
import { NumberField } from '../../../ui/Field';
import { Icon } from '../../../ui/Icon';
import { Segmented } from '../../../ui/Layout';
import { dueTaxMonths, TAX_DUE_DAY, taxSpentEur, type YearTax } from '../model';

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
  // undefined = automatic: a month counts once its 15th has passed.
  const [ticked, setTicked] = useState<number[] | undefined>(value?.paidMonths);
  const due = dueTaxMonths(year);
  const paid = ticked ?? due;
  const draft: YearTax = { monthly, currency, rsdPerEur, ...(ticked ? { paidMonths: ticked } : {}) };
  const monthLabel = (month: number) => new Intl.DateTimeFormat(uiLocale(), { month: 'short' }).format(new Date(year, month - 1, 1));
  const toggle = (month: number) => {
    const next = paid.includes(month) ? paid.filter((item) => item !== month) : [...paid, month].sort((a, b) => a - b);
    setTicked(next);
  };

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
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">{t('Paid months')}</span>
              {ticked ? (
                <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setTicked(undefined)}>
                  {t('Back to automatic')}
                </button>
              ) : (
                <span className="text-xs text-slate-400">{t('Automatic: from the {day}th of each month', { day: TAX_DUE_DAY })}</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                const on = paid.includes(month);
                return (
                  <button
                    key={month}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(month)}
                    className={`flex h-9 items-center justify-center gap-1 rounded-lg text-[13px] font-medium capitalize ring-1 ring-inset transition ${
                      on ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {on && <Icon name="check" className="h-3.5 w-3.5" />}
                    {monthLabel(month).replace('.', '')}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">{t('Tap a month to mark it paid or unpaid.')}</p>
          </div>
          {monthly > 0 && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {t('So far in {year}: {months} × {monthly} = {total}', {
                year,
                months: paid.length,
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
