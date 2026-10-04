import { useState } from 'react';
import { t } from '../../i18n';
import { fetchRsdPerEur } from '../../lib/fx';
import { formatAmount } from '../../lib/money';
import { Button, IconButton } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { NumberField } from '../../ui/Field';
import { Section, Segmented } from '../../ui/Layout';
import type { TaxYear } from '../invoices/model';
import { createTaxYear, monthlyTaxEur } from '../invoices/taxes';

type Props = { taxes: TaxYear[]; onChange: (taxes: TaxYear[]) => void };

/** Monthly tax and contributions per year, in RSD or EUR. */
export const TaxesSection = ({ taxes, onChange }: Props) => {
  const { toast } = useFeedback();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const sorted = [...taxes].sort((a, b) => b.year - a.year);
  const update = (id: string, patch: Partial<TaxYear>) => onChange(taxes.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));

  const applyTodaysRate = async (entry: TaxYear) => {
    setLoadingId(entry.id);
    const { rate, live } = await fetchRsdPerEur();
    setLoadingId(null);
    update(entry.id, { rsdPerEur: rate });
    toast(live ? t('Exchange rate updated: 1 EUR = {rate} RSD', { rate: rate.toFixed(2) }) : t('Could not fetch the rate; using {rate}. You can type it yourself.', { rate }), live ? 'success' : 'info');
  };

  const addYear = async () => {
    const latest = sorted[0];
    const year = latest ? latest.year + 1 : new Date().getFullYear();
    const entry = createTaxYear({ year, monthlyAmount: latest?.monthlyAmount ?? 0, currency: latest?.currency ?? 'RSD', rsdPerEur: latest?.rsdPerEur });
    onChange([...taxes, entry]);
    const { rate, live } = await fetchRsdPerEur();
    if (live) onChange([...taxes, { ...entry, rsdPerEur: rate }]);
  };

  return (
    <Section id="taxes" title={t('Taxes and contributions')} icon="cash" description={t('What you pay each month, per year. Used to show what is left of every invoice.')}>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">{t('Add the monthly amount from your tax decision (for example the flat-rate "paušal"). It changes every year, so each year has its own amount.')}</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((entry) => {
            const eur = monthlyTaxEur(entry);
            return (
              <li key={entry.id} className="rounded-xl bg-slate-50/70 p-4 ring-1 ring-slate-200/70">
                <div className="flex flex-wrap items-end gap-3">
                  <NumberField label={t('Year')} value={entry.year} onChange={(year) => update(entry.id, { year: Math.round(year) })} min={2000} wrapperClassName="w-24" />
                  <NumberField
                    label={t('Per month')}
                    value={entry.monthlyAmount}
                    onChange={(monthlyAmount) => update(entry.id, { monthlyAmount })}
                    min={0}
                    suffix={entry.currency}
                    wrapperClassName="min-w-[140px] flex-1"
                  />
                  <div>
                    <div className="mb-1.5 text-[13px] font-medium text-slate-700">{t('Currency')}</div>
                    <Segmented<'RSD' | 'EUR'>
                      value={entry.currency}
                      onChange={(currency) => update(entry.id, { currency })}
                      options={[
                        { value: 'RSD', label: 'RSD' },
                        { value: 'EUR', label: 'EUR' }
                      ]}
                    />
                  </div>
                  <IconButton icon="trash" tone="danger" label={t('Remove year {year}', { year: entry.year })} onClick={() => onChange(taxes.filter((other) => other.id !== entry.id))} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-end gap-2">
                    <NumberField
                      label={t('Exchange rate (RSD for 1 EUR)')}
                      value={entry.rsdPerEur}
                      onChange={(rsdPerEur) => rsdPerEur > 0 && update(entry.id, { rsdPerEur })}
                      min={1}
                      wrapperClassName="w-44"
                    />
                    <Button size="sm" icon="refresh" onClick={() => applyTodaysRate(entry)} disabled={loadingId === entry.id}>
                      {loadingId === entry.id ? t('Loading…') : t("Today's rate")}
                    </Button>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-slate-900">
                      {t('{amount} per month', { amount: formatAmount(eur, 'EUR') })}
                    </div>
                    <div className="text-xs text-slate-500">{t('{amount} per year', { amount: formatAmount(eur * 12, 'EUR') })}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button className="mt-3" size="sm" icon="plus" onClick={addYear}>
        {sorted.length ? t('Add next year') : t('Add this year')}
      </Button>
    </Section>
  );
};
