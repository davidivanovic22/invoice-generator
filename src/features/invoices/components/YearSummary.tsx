import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../../i18n';
import { formatAmount } from '../../../lib/money';
import { Icon } from '../../../ui/Icon';
import type { InvoiceStore } from '../model';
import { yearSummary } from '../taxes';

/** Income, taxes so far and what is left, for one year (all in EUR). */
export const YearSummary = ({ store }: { store: InvoiceStore }) => {
  const years = useMemo(() => {
    const all = new Set<number>([new Date().getFullYear(), ...store.invoices.map((invoice) => Number(invoice.issueDate.slice(0, 4))), ...store.profile.taxes.map((entry) => entry.year)]);
    return Array.from(all).filter(Boolean).sort((a, b) => b - a);
  }, [store.invoices, store.profile.taxes]);
  const [year, setYear] = useState(years[0]);
  const summary = yearSummary(store.invoices, store.profile, year);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <Icon name="cash" />
          {t('Year overview')}
        </h2>
        <select
          aria-label={t('Year')}
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          className="rounded-lg border-0 bg-slate-100 py-1 pl-3 pr-8 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
        >
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[13px] text-slate-500">{t('Invoiced (sent and paid)')}</div>
          <div className="text-xl font-bold tabular-nums text-slate-900">{formatAmount(summary.incomeEur, 'EUR')}</div>
        </div>
        <div>
          <div className="text-[13px] text-slate-500">
            {summary.hasTax ? t('Tax and contributions ({count} month)|Tax and contributions ({count} months)', { count: summary.months }) : t('Tax and contributions')}
          </div>
          {summary.hasTax ? (
            <div className="text-xl font-bold tabular-nums text-slate-900">− {formatAmount(summary.taxEur, 'EUR')}</div>
          ) : (
            <Link to="/profile#taxes" className="text-sm font-medium text-indigo-600 hover:underline">
              {t('Add your monthly tax for {year}', { year })}
            </Link>
          )}
        </div>
        <div>
          <div className="text-[13px] text-slate-500">{t('Left for you')}</div>
          <div className={`text-xl font-bold tabular-nums ${summary.netEur < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatAmount(summary.netEur, 'EUR')}</div>
        </div>
      </div>
      {summary.skipped > 0 && (
        <p className="mt-3 text-xs text-slate-400">{t('{count} invoice in another currency is not included.|{count} invoices in other currencies are not included.', { count: summary.skipped })}</p>
      )}
    </section>
  );
};
