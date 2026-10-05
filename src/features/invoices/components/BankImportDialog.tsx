import { useEffect, useRef, useState } from 'react';
import { t, uiLocale } from '../../../i18n';
import { formatDate } from '../../../lib/dates';
import { formatAmount } from '../../../lib/money';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { readSpreadsheet } from '../../kpo/importKpo';
import { matchPayments, parseStatement, type Payment, type PaymentMatch } from '../bankImport';
import { invoiceTotals } from '../model';
import { useInvoiceStore } from '../store';

/** Reads a bank statement and marks the matching invoices paid on the day the money arrived. */
export const BankImportDialog = ({ onClose }: { onClose: () => void }) => {
  const { store, markPaid } = useInvoiceStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ matches: PaymentMatch[]; unmatched: Payment[] } | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const read = async (file: File) => {
    setBusy(true);
    setError('');
    setFileName(file.name);
    setResult(null);
    try {
      const payments = (await readSpreadsheet(file)).map(parseStatement).find((sheet) => sheet && sheet.length);
      if (!payments) {
        setError(t('No incoming payments were found. The file needs a date column and an amount (or "Uplata" / "Priliv") column. Export the statement from your e-banking as Excel or CSV.'));
        return;
      }
      const matched = matchPayments(payments, store.invoices);
      setResult(matched);
      // Exact amounts are ticked; payments reduced by bank charges are for you to confirm.
      setSelected(matched.matches.map((match) => match.kind === 'exact'));
    } catch {
      setError(t('That file could not be read. Save it as .xlsx or .csv and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const chosen = result ? result.matches.filter((_match, index) => selected[index]) : [];
  const apply = () => {
    chosen.forEach((match) => markPaid(match.invoice.id, match.payment.date));
    onClose();
  };
  const date = (iso: string) => formatDate(iso, uiLocale());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="bank-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="bank-title" className="text-lg font-semibold text-slate-900">
            {t('Import a bank statement')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('Incoming payments are matched with your invoices, which are then marked paid on the day the money arrived.')}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Icon name="upload" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{fileName || t('Choose file')}</span>
              <span className="block text-xs text-slate-500">{busy ? t('Reading…') : '.xlsx, .csv'}</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void read(file);
            }}
          />
          {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {result && (
            <>
              {result.matches.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{t('No payment in this statement matches an open invoice.')}</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                  {result.matches.map((match, index) => {
                    const total = invoiceTotals(match.invoice).total;
                    return (
                      <li key={match.invoice.id}>
                        <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected[index]}
                            onChange={(event) => setSelected(selected.map((value, position) => (position === index ? event.target.checked : value)))}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                          />
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="flex flex-wrap items-center gap-x-2">
                              <span className="font-semibold text-slate-900">#{match.invoice.number}</span>
                              <span className="text-slate-600">{match.invoice.client.name}</span>
                              <span className="tabular-nums text-slate-500">{formatAmount(total, match.invoice.currency)}</span>
                              {match.fixesDate && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">{t('fixes the payment date')}</span>}
                              {match.kind === 'fees' && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                                  {t('{amount} less arrived (bank charges?)', { amount: formatAmount(total - match.payment.amount, match.invoice.currency) })}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {t('Paid {date}', { date: date(match.payment.date) })} · {formatAmount(match.payment.amount, match.invoice.currency)}
                              {match.payment.text && ` · ${match.payment.text}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {result.unmatched.length > 0 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-slate-500">{t('{count} other incoming payment|{count} other incoming payments', { count: result.unmatched.length })}</summary>
                  <ul className="mt-2 space-y-1 text-xs text-slate-500">
                    {result.unmatched.map((payment, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="w-24 shrink-0 tabular-nums">{date(payment.date)}</span>
                        <span className="w-24 shrink-0 text-right tabular-nums">{payment.amount.toLocaleString(uiLocale(), { minimumFractionDigits: 2 })}</span>
                        <span className="min-w-0 truncate">{payment.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="accent" icon="check" onClick={apply} disabled={!chosen.length}>
            {t('Mark {count} invoice as paid|Mark {count} invoices as paid', { count: chosen.length })}
          </Button>
        </div>
      </div>
    </div>
  );
};
