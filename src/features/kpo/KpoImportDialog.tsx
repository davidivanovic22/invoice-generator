import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { formatDateNumeric, todayIso } from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Layout';
import { importKpoFile, type ParsedBook } from './importKpo';
import { useInvoiceStore } from '../invoices/store';
import { bookableInvoices, createEntry, entryTotal, round2, type KpoBook, type KpoHeader } from './model';
import { useKpo } from './store';

type Props = { onClose: () => void; onImported: (year: number | null) => void };

const HEADER_NAMES: Record<keyof KpoHeader, string> = {
  pib: 'PIB',
  taxpayer: 'Obveznik',
  business: 'Firma-radnje',
  seat: 'Sedište',
  taxpayerCode: 'Šifra poreskog obveznika',
  activity: 'Šifra delatnosti'
};

/** Imports an existing KPO book from Excel or CSV, with a preview. */
export const KpoImportDialog = ({ onClose, onImported }: Props) => {
  const { book, update } = useKpo();
  const { toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedBook | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [currency, setCurrency] = useState<KpoBook['currency']>(book.currency);
  const [useHeader, setUseHeader] = useState(true);
  const [settleOlder, setSettleOlder] = useState(true);
  const { store } = useInvoiceStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = todayIso();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isDuplicate = (row: ParsedBook['rows'][number]) =>
    book.entries.some((entry) => entry.date === row.date && Math.abs(entryTotal(entry) - round2(row.products + row.services)) < 0.01);

  const read = async (file: File) => {
    setBusy(true);
    setError('');
    setFileName(file.name);
    try {
      const result = await importKpoFile(file);
      if (!result) {
        setParsed(null);
        setError(t('No KPO table was found in this file. It needs columns like "Datum i opis knjiženja" and "od izvršenih usluga" or "Svega".'));
        return;
      }
      setParsed(result);
      setSelected(result.rows.map((row) => Boolean(row.date) && !isDuplicate(row)));
      // Small amounts are almost certainly euros; the official form is in dinars.
      const largest = Math.max(...result.rows.map((row) => row.products + row.services));
      setCurrency(book.entries.length ? book.currency : largest > 50_000 ? 'RSD' : 'EUR');
    } catch {
      setError(t('That file could not be read. Save it as .xlsx or .csv and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const chosen = parsed ? parsed.rows.filter((row, index) => selected[index] && row.date) : [];
  // The last booking that already happened: invoices issued up to then are in the imported book.
  const lastBooked = chosen.map((row) => row.date!).filter((date) => date <= today).sort().pop() ?? null;
  const covered = lastBooked ? bookableInvoices(store.invoices, book.bookOn).filter((invoice) => invoice.issueDate <= lastBooked) : [];
  const headerFound = parsed ? (Object.entries(parsed.header) as [keyof KpoHeader, string][]).filter(([, value]) => value) : [];

  const confirm = () => {
    if (!parsed || !chosen.length) return;
    update((current) => ({
      ...current,
      currency,
      header: useHeader ? { ...current.header, ...parsed.header } : current.header,
      settledInvoiceIds: settleOlder ? Array.from(new Set([...current.settledInvoiceIds, ...covered.map((invoice) => invoice.id)])) : current.settledInvoiceIds,
      entries: [
        ...current.entries,
        ...chosen.map((row) => createEntry({ date: row.date!, description: row.description, products: row.products, services: row.services, source: 'import' }))
      ]
    }));
    toast(t('{count} entry imported|{count} entries imported', { count: chosen.length }));
    const years = chosen.map((row) => Number(row.date!.slice(0, 4)));
    onImported(years.length ? Math.max(...years) : null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="kpo-import-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="kpo-import-title" className="text-lg font-semibold text-slate-900">
            {t('Import your KPO book')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('Choose your Excel (.xlsx) or CSV file. You will see every row before anything is saved.')}</p>
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

          {parsed && (
            <>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-700">
                  {t('Amounts in this file are in')}
                </div>
                <Segmented<KpoBook['currency']>
                  value={currency}
                  onChange={setCurrency}
                  options={[
                    { value: 'EUR', label: 'EUR' },
                    { value: 'RSD', label: 'RSD' }
                  ]}
                />
              </div>

              {headerFound.length > 0 && (
                <label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200/70">
                  <input type="checkbox" checked={useHeader} onChange={(event) => setUseHeader(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span>
                    <span className="font-medium text-slate-900">{t('Use the taxpayer details from the file')}</span>
                    <span className="mt-1 block text-xs text-slate-500">{headerFound.map(([field, value]) => `${HEADER_NAMES[field]}: ${value}`).join(' · ')}</span>
                  </span>
                </label>
              )}

              {covered.length > 0 && lastBooked && (
                <label className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200/70">
                  <input type="checkbox" checked={settleOlder} onChange={(event) => setSettleOlder(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span>
                    <span className="font-medium text-slate-900">{t('My invoices issued up to {date} are already in this book', { date: formatDateNumeric(lastBooked) })}</span>
                    <span className="mt-1 block text-xs text-slate-500">{t('{count} invoice will not be suggested for the book again.|{count} invoices will not be suggested for the book again.', { count: covered.length })}</span>
                  </span>
                </label>
              )}

              <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={t('Select all')}
                          checked={selected.every(Boolean)}
                          onChange={(event) => setSelected(parsed.rows.map((row) => event.target.checked && Boolean(row.date)))}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                      </th>
                      <th className="px-3 py-2">{t('Date')}</th>
                      <th className="px-3 py-2">{t('Description')}</th>
                      <th className="px-3 py-2 text-right">{t('Amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.rows.map((row, index) => {
                      const duplicate = isDuplicate(row);
                      return (
                        <tr key={index} className={selected[index] ? '' : 'text-slate-400'}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              disabled={!row.date}
                              checked={selected[index]}
                              onChange={(event) => setSelected(selected.map((value, position) => (position === index ? event.target.checked : value)))}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums">{row.date ? formatDateNumeric(row.date) : <span className="text-red-500">{t('no date')}</span>}</td>
                          <td className="px-3 py-2">
                            {row.description}
                            {duplicate && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">{t('already in the book')}</span>}
                            {row.date && row.date > today && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{t('Planned')}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatAmount(row.products + row.services, currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {book.entries.length > 0 && currency !== book.currency && (
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('Your book is in {current}. Importing switches it to {next}; existing amounts are not converted.', { current: book.currency, next: currency })}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <span className="text-sm text-slate-500">{parsed ? t('{count} of {total} rows selected', { count: chosen.length, total: parsed.rows.length }) : ''}</span>
          <div className="flex gap-2">
            <Button onClick={onClose}>{t('Cancel')}</Button>
            <Button variant="accent" icon="check" onClick={confirm} disabled={!chosen.length}>
              {t('Import ({count})', { count: chosen.length })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
