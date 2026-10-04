import { Link } from 'react-router-dom';
import { t, uiLocale } from '../../../i18n';
import { formatAmount } from '../../../lib/money';
import { parseIsoDate } from '../../../lib/dates';
import { Icon } from '../../../ui/Icon';
import type { BusinessProfile, Invoice } from '../model';
import { invoiceNet } from '../taxes';

/** Private summary of what is left after this month's tax. Never printed on the invoice. */
export const TaxCard = ({ invoice, profile }: { invoice: Invoice; profile: BusinessProfile }) => {
  const net = invoiceNet(invoice, profile);
  const year = invoice.issueDate.slice(0, 4);
  const month = new Intl.DateTimeFormat(uiLocale(), { month: 'long' }).format(parseIsoDate(invoice.issueDate) ?? new Date());

  if (!net) {
    const unsupported = invoice.currency !== 'EUR' && invoice.currency !== 'RSD' && profile.taxes.some((entry) => String(entry.year) === year);
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-4 text-sm">
        <Icon name="cash" className="h-5 w-5 shrink-0 text-slate-400" />
        {unsupported ? (
          <span className="text-slate-500">{t('After-tax amount is shown for invoices in EUR or RSD.')}</span>
        ) : (
          <span className="text-slate-600">
            {t('See what is left after taxes:')}{' '}
            <Link to="/profile#taxes" className="font-medium text-indigo-600 hover:underline">
              {t('add your monthly tax for {year}', { year })}
            </Link>
          </span>
        )}
      </div>
    );
  }

  const share = net.totalEur > 0 ? Math.min(1, Math.max(0, net.netEur / net.totalEur)) : 0;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-5 ring-1 ring-emerald-100">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-emerald-950">
          <Icon name="cash" />
          {t('What you keep')}
        </h2>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-emerald-800">{t('Only for you, not printed')}</span>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-emerald-900/80">
          <dt>{t('Invoice total')}</dt>
          <dd className="tabular-nums">{formatAmount(net.totalEur, 'EUR')}</dd>
        </div>
        <div className="flex justify-between text-emerald-900/80">
          <dt>{t('Tax and contributions for {month}', { month })}</dt>
          <dd className="tabular-nums">− {formatAmount(net.taxEur, 'EUR')}</dd>
        </div>
        <div className="flex justify-between border-t border-emerald-200 pt-2 text-base font-semibold text-emerald-950">
          <dt>{t('Left for you')}</dt>
          <dd className="tabular-nums">{formatAmount(net.netEur, 'EUR')}</dd>
        </div>
      </dl>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share * 100}%` }} />
      </div>
      {invoice.currency === 'RSD' && (
        <p className="mt-2 text-xs text-emerald-900/60">{t('Converted at the rate saved for {year}.', { year })}</p>
      )}
    </section>
  );
};
