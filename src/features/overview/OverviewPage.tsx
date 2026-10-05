import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, uiLocale } from '../../i18n';
import { todayIso } from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import { cachedRate, convert } from '../../lib/nbs';
import { useNbsRates } from '../../lib/useNbsRates';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Layout';
import { useInvoiceStore } from '../invoices/store';
import { bookYears } from '../kpo/model';
import { useKpo } from '../kpo/store';
import { FLAT_RATE_LIMIT_RSD, incomeBetween, incomeEvents, monthlyRows, taxSchedule, VAT_LIMIT_RSD, yearBefore, type MonthRow } from './model';

type Display = 'EUR' | 'RSD';

const DISPLAY_KEY = 'studio.overview.currency';
const readDisplay = (): Display => {
  try {
    return localStorage.getItem(DISPLAY_KEY) === 'RSD' ? 'RSD' : 'EUR';
  } catch {
    return 'EUR';
  }
};

export const OverviewPage = () => {
  const { store } = useInvoiceStore();
  const { book } = useKpo();
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const invoiceYears = store.invoices.map((invoice) => Number(invoice.issueDate.slice(0, 4))).filter(Boolean);
  const years = Array.from(new Set([thisYear, ...bookYears(book), ...invoiceYears])).sort((a, b) => b - a);
  const [year, setYear] = useState(thisYear);
  const [display, setDisplayState] = useState<Display>(readDisplay);
  const setDisplay = (value: Display) => {
    setDisplayState(value);
    try {
      localStorage.setItem(DISPLAY_KEY, value);
    } catch {
      // Remembered for this visit only.
    }
  };

  const events = useMemo(() => incomeEvents(book, store.invoices, years, today), [book, store.invoices, years.join(), today]); // eslint-disable-line react-hooks/exhaustive-deps
  const yearTax = store.profile.yearlyTax[String(year)];

  const clamp = (date: string) => (date > today ? today : date);
  // Every rate the page needs: each event in the display currency and in RSD, and EUR mid-month for the tax.
  const loading = useNbsRates([
    ...events.flatMap((event) => [
      { currency: event.currency, date: clamp(event.date) },
      { currency: display, date: clamp(event.date) }
    ]),
    ...Array.from({ length: 12 }, (_, index) => ({ currency: 'EUR', date: clamp(`${year}-${String(index + 1).padStart(2, '0')}-15`) }))
  ]);

  const toDisplay = (amount: number, currency: string, date: string) => convert(amount, currency, display, clamp(date));
  const toRsd = (amount: number, currency: string, date: string) => convert(amount, currency, 'RSD', clamp(date));
  const taxFor = taxSchedule(yearTax, year, new Date(), (amount, currency, month) => {
    if (currency === display) return amount;
    const date = `${year}-${String(month).padStart(2, '0')}-15`;
    const eur = cachedRate('EUR', clamp(date)) ?? yearTax?.rsdPerEur ?? 117.2;
    return currency === 'RSD' ? amount / (yearTax?.rsdPerEur || eur) : amount * eur;
  });
  const rows = monthlyRows(events, year, toDisplay, taxFor);

  const income = rows.reduce((sum, row) => sum + row.income, 0);
  const planned = rows.reduce((sum, row) => sum + row.planned, 0);
  const tax = rows.reduce((sum, row) => sum + (row.taxPlanned ? 0 : row.tax), 0);
  const monthsWithIncome = rows.filter((row) => row.income > 0).length;
  const money = (value: number) => formatAmount(value, display);

  const yearIncomeRsd = incomeBetween(events, `${year}-01-01`, `${year}-12-31`, toRsd);
  const rollingRsd = incomeBetween(events, yearBefore(today), today, toRsd);
  const incomplete = loading || rows.some((row) => row.incomplete);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('Overview')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('Income per month, flat-rate tax, what you actually earned, and how close you are to the limits.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<string> value={String(year)} onChange={(value) => setYear(Number(value))} options={years.map((value) => ({ value: String(value), label: String(value) }))} />
          <Segmented<Display>
            value={display}
            onChange={setDisplay}
            options={[
              { value: 'EUR', label: 'EUR' },
              { value: 'RSD', label: 'RSD' }
            ]}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('Income in {year}', { year })} value={money(income)} detail={planned > 0 ? t('+ {amount} planned', { amount: money(planned) }) : t('Booked and paid')} />
        <Stat label={t('Tax paid')} value={money(tax)} detail={yearTax ? t('{count} month|{count} months', { count: rows.filter((row) => row.tax > 0 && !row.taxPlanned).length }) : t('Not entered')} tone="red" link={yearTax ? undefined : '/invoices'} />
        <Stat label={t('Earned after tax')} value={money(income - tax)} detail={t('Income minus tax')} tone="green" />
        <Stat label={t('Average per month')} value={money(monthsWithIncome ? (income - tax) / monthsWithIncome : 0)} detail={t('After tax, months with income')} />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('Month by month')}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <Legend className="bg-indigo-500" label={t('Income')} />
            <Legend className="bg-indigo-200" label={t('Planned')} />
            <Legend className="bg-rose-400" label={t('Tax')} />
          </div>
        </div>
        <Chart rows={rows} money={money} />
        {incomplete && <p className="mt-3 text-xs text-slate-400">{t('Loading NBS exchange rates…')}</p>}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Limit
          title={t('Flat-rate limit {year}', { year })}
          description={t('Income in a calendar year must stay under {limit} to keep flat-rate taxation.', { limit: formatAmount(FLAT_RATE_LIMIT_RSD, 'RSD') })}
          used={yearIncomeRsd.total}
          limit={FLAT_RATE_LIMIT_RSD}
        />
        <Limit
          title={t('VAT limit (last 12 months)')}
          description={t('Above {limit} in any 12 months you must register for VAT.', { limit: formatAmount(VAT_LIMIT_RSD, 'RSD') })}
          used={rollingRsd.total}
          limit={VAT_LIMIT_RSD}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('Limits are converted to dinars with the NBS middle rate on each booking date. Check the current amounts with your accountant.')}</p>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('Month')}</th>
                <th className="px-4 py-3 text-right">{t('Income')}</th>
                <th className="px-4 py-3 text-right">{t('Tax')}</th>
                <th className="px-4 py-3 text-right">{t('Earned after tax')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.month} className={row.income === 0 && row.planned === 0 ? 'text-slate-400' : 'text-slate-700'}>
                  <td className="px-4 py-2.5 capitalize">{monthName(year, row.month)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(row.income)}
                    {row.planned > 0 && <span className="ml-1 text-xs text-indigo-400">+{money(row.planned)}</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${!row.tax ? 'text-slate-300' : row.taxPlanned ? 'text-slate-300' : 'text-rose-600'}`}>{row.tax ? `−${money(row.tax)}` : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${row.net < 0 ? 'text-red-600' : 'text-slate-900'}`}>{money(row.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-3">{t('Total')}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(income)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-600">−{money(tax)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(income - tax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {t('Income comes from your KPO book; invoices that are not booked yet are added automatically.')}{' '}
        <Link to="/kpo" className="font-medium text-indigo-600 hover:underline">
          {t('Open KPO book')}
        </Link>
      </p>
    </div>
  );
};

const monthName = (year: number, month: number) => new Intl.DateTimeFormat(uiLocale(), { month: 'long' }).format(new Date(year, month - 1, 1));

const Stat = ({ label, value, detail, tone, link }: { label: string; value: string; detail: string; tone?: 'red' | 'green'; link?: string }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
    <div className="text-[13px] font-medium text-slate-500">{label}</div>
    <div className={`mt-1 truncate text-xl font-bold tabular-nums ${tone === 'red' ? 'text-rose-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div>
    {link ? (
      <Link to={link} className="mt-0.5 block text-xs font-medium text-indigo-600 hover:underline">
        {detail}
      </Link>
    ) : (
      <div className="mt-0.5 text-xs text-slate-400">{detail}</div>
    )}
  </div>
);

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
    {label}
  </span>
);

const Chart = ({ rows, money }: { rows: MonthRow[]; money: (value: number) => string }) => {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.income + row.planned, row.tax)));
  return (
    <div className="mt-5 grid h-56 grid-cols-12 items-end gap-1.5 sm:gap-3">
      {rows.map((row) => {
        const incomeHeight = (row.income / max) * 100;
        const plannedHeight = (row.planned / max) * 100;
        const taxHeight = (row.tax / max) * 100;
        return (
          <div key={row.month} className="group relative flex h-full flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5 sm:gap-1">
              <div className="flex h-full w-full max-w-[28px] flex-col justify-end">
                <div className="w-full rounded-t-md bg-indigo-200" style={{ height: `${plannedHeight}%` }} />
                <div className={`w-full bg-indigo-500 ${plannedHeight ? '' : 'rounded-t-md'}`} style={{ height: `${incomeHeight}%` }} />
              </div>
              <div className={`w-1.5 rounded-t-sm sm:w-2.5 ${row.taxPlanned ? 'bg-rose-200' : 'bg-rose-400'}`} style={{ height: `${taxHeight}%` }} />
            </div>
            <div className="mt-1.5 text-center text-[10px] font-medium uppercase text-slate-400 sm:text-[11px]">
              {new Intl.DateTimeFormat(uiLocale(), { month: 'short' }).format(new Date(2000, row.month - 1, 1)).replace('.', '')}
            </div>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block">
              <div>
                {t('Income')}: {money(row.income)}
              </div>
              {row.planned > 0 && (
                <div className="text-indigo-200">
                  {t('Planned')}: {money(row.planned)}
                </div>
              )}
              <div className="text-rose-200">
                {t('Tax')}: {money(row.tax)}
              </div>
              <div className="font-semibold">
                {t('Earned after tax')}: {money(row.net)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Limit = ({ title, description, used, limit }: { title: string; description: string; used: number; limit: number }) => {
  const share = used / limit;
  const tone = share >= 1 ? 'bg-red-500' : share >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        {share >= 0.8 && <Icon name="alert" className={`h-5 w-5 shrink-0 ${share >= 1 ? 'text-red-500' : 'text-amber-500'}`} />}
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums text-slate-900">
          {formatAmount(used, 'RSD')} <span className="font-normal text-slate-400">/ {formatAmount(limit, 'RSD')}</span>
        </span>
        <span className={`tabular-nums ${share >= 1 ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
          {share >= 1 ? t('Over the limit') : t('{percent}% · {amount} left', { percent: Math.round(share * 100), amount: formatAmount(limit - used, 'RSD') })}
        </span>
      </div>
    </div>
  );
};
