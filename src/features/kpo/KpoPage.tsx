import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, uiLocale } from '../../i18n';
import { formatDate, formatDateNumeric, todayIso } from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import { convert } from '../../lib/nbs';
import { printToPdf } from '../../lib/pdf';
import { useNbsRates } from '../../lib/useNbsRates';
import { Button, IconButton } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { inputClass, SelectField, TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { EmptyState, Section, Segmented } from '../../ui/Layout';
import { invoiceTotals, type Invoice } from '../invoices/model';
import { useInvoiceStore } from '../invoices/store';
import { exportKpoCsv, exportKpoXlsx, kpoFileName } from './exportKpo';
import { KpoImportDialog } from './KpoImportDialog';
import {
  bookableInvoices,
  bookYear,
  bookYears,
  createEntry,
  describeWithDate,
  entryFromInvoice,
  entryTotal,
  findEntryForInvoice,
  invoiceBookingDate,
  parseAmount,
  yearTotals,
  type KpoBook,
  type KpoEntry
} from './model';
import { useKpo } from './store';

/** Rate from the invoice currency to the book currency on the booking date (1 when they match). */
export const bookRate = (invoice: Invoice, book: KpoBook) =>
  invoice.currency === book.currency ? 1 : convert(1, invoice.currency, book.currency, invoiceBookingDate(invoice, book.bookOn));

/** Bookable invoices of a year that are not in the book yet. */
export const invoicesMissingFromBook = (invoices: Invoice[], book: KpoBook, year: number) =>
  bookableInvoices(invoices, book.bookOn).filter((invoice) => {
    if (!invoiceBookingDate(invoice, book.bookOn).startsWith(String(year))) return false;
    const rate = bookRate(invoice, book);
    return !findEntryForInvoice(invoice, book.entries, rate === null ? null : invoiceTotals(invoice).total * rate, book.bookOn);
  });

export const KpoPage = () => {
  const { book, update, addEntries, updateEntry, removeEntry, restoreEntry } = useKpo();
  const { store } = useInvoiceStore();
  const { toast } = useFeedback();
  const today = todayIso();
  const years = Array.from(new Set([Number(today.slice(0, 4)), ...bookYears(book)])).sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [includePlanned, setIncludePlanned] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const money = (value: number) => formatAmount(value, book.currency);

  // Rates for invoices in another currency than the book.
  const foreign = bookableInvoices(store.invoices, book.bookOn).filter((invoice) => invoice.currency !== book.currency);
  const loadingRates = useNbsRates(
    foreign.flatMap((invoice) => {
      const date = invoiceBookingDate(invoice, book.bookOn);
      return [
        { currency: invoice.currency, date },
        { currency: book.currency, date }
      ];
    })
  );

  const rows = bookYear(book, year, today);
  const booked = yearTotals(rows);
  const planned = yearTotals(rows.filter((row) => row.planned), true);
  const missing = useMemo(() => invoicesMissingFromBook(store.invoices, book, year), [store.invoices, book, year, loadingRates]); // eslint-disable-line react-hooks/exhaustive-deps

  const addInvoices = (invoices: Invoice[]) => {
    const entries = invoices.map((invoice) => entryFromInvoice(invoice, book, bookRate(invoice, book))).filter((entry): entry is KpoEntry => entry !== null);
    if (!entries.length) return toast(t('The exchange rate is not loaded yet. Try again in a moment.'), 'error');
    addEntries(entries);
    toast(t('{count} invoice added to the book|{count} invoices added to the book', { count: entries.length }));
  };

  const exportPdf = async () => {
    if (!printRef.current) return;
    try {
      await printToPdf(printRef.current, kpoFileName(book, year, 'pdf'));
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('KPO book')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('Book of turnover for flat-rate taxpayers. Add invoices with one click, import your existing book, export to Excel or PDF.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon="upload" onClick={() => setImporting(true)}>
            {t('Import')}
          </Button>
          <Button icon="download" onClick={() => void exportKpoXlsx(book, year, includePlanned)} disabled={!rows.length}>
            Excel
          </Button>
          <Button icon="printer" onClick={exportPdf} disabled={!rows.length}>
            PDF
          </Button>
          <Button variant="ghost" onClick={() => exportKpoCsv(book, year, includePlanned)} disabled={!rows.length}>
            CSV
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<string> value={String(year)} onChange={(value) => setYear(Number(value))} options={years.map((value) => ({ value: String(value), label: String(value) }))} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includePlanned} onChange={(event) => setIncludePlanned(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          {t('Include planned entries in exports')}
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card label={t('Booked in {year}', { year })} value={money(booked.total)} detail={t('{count} entry|{count} entries', { count: rows.filter((row) => !row.planned).length })} accent />
        <Card label={t('Planned')} value={money(planned.total)} detail={t('Future dates, not numbered yet')} />
        <Card label={t('Products / services')} value={`${money(booked.products)} / ${money(booked.services)}`} detail={t('Columns 3 and 4')} />
      </div>

      {missing.length > 0 && (
        <div className="mt-4 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
              <Icon name="bolt" className="h-4 w-4" />
              {t('{count} invoice is not in the book yet|{count} invoices are not in the book yet', { count: missing.length })}
            </div>
            <Button size="sm" variant="accent" icon="plus" onClick={() => addInvoices(missing)}>
              {t('Add all')}
            </Button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {missing.map((invoice) => {
              const rate = bookRate(invoice, book);
              const date = invoiceBookingDate(invoice, book.bookOn);
              return (
                <li key={invoice.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-indigo-100">
                  <Link to={`/invoices/${invoice.id}`} className="font-medium text-slate-900 hover:underline">
                    #{invoice.number}
                  </Link>
                  <span className="text-slate-500">{invoice.client.name}</span>
                  <span className="text-slate-400">{formatDate(date, uiLocale())}</span>
                  <span className="ml-auto tabular-nums text-slate-700">
                    {formatAmount(invoiceTotals(invoice).total, invoice.currency)}
                    {invoice.currency !== book.currency && (
                      <span className="text-slate-400"> → {rate === null ? t('loading rate…') : money(invoiceTotals(invoice).total * rate)}</span>
                    )}
                  </span>
                  <Button size="sm" icon="plus" onClick={() => addInvoices([invoice])} disabled={rate === null}>
                    {t('Add')}
                  </Button>
                </li>
              );
            })}
          </ul>
          {book.bookOn === 'paid' && <p className="mt-2 text-xs text-indigo-700/80">{t('Paid invoices are booked on the day they were marked paid.')}</p>}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        {rows.length === 0 && !adding ? (
          <div className="p-6">
            <EmptyState
              icon="list"
              title={t('No entries in {year}', { year })}
              description={t('Import your existing KPO book, add invoices above, or add an entry by hand.')}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon="upload" onClick={() => setImporting(true)}>
                    {t('Import my KPO book')}
                  </Button>
                  <Button icon="plus" onClick={() => setAdding(true)}>
                    {t('Add entry')}
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-slate-800 text-left text-[12px] font-semibold uppercase tracking-wide text-white">
                  <th className="w-16 px-4 py-3 text-center">{t('No.')}</th>
                  <th className="px-4 py-3">{t('Date and description')}</th>
                  <th className="w-36 px-4 py-3 text-right">{t('Products')}</th>
                  <th className="w-36 px-4 py-3 text-right">{t('Services')}</th>
                  <th className="w-40 bg-slate-700 px-4 py-3 text-right">{t('Total (3+4)')}</th>
                  <th className="w-20 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ entry, number, planned: isPlanned }) => (
                  <KpoRow
                    key={entry.id}
                    entry={entry}
                    number={number}
                    planned={isPlanned}
                    money={money}
                    onSave={(patch) => updateEntry(entry.id, patch)}
                    onDelete={() => {
                      const removed = removeEntry(entry.id);
                      if (removed) toast(t('Entry deleted'), 'success', { label: t('Undo'), onClick: () => restoreEntry(removed) });
                    }}
                  />
                ))}
                {adding && (
                  <KpoRow
                    entry={createEntry({ date: year === Number(today.slice(0, 4)) ? today : `${year}-12-31`, description: book.entryTemplate.replace(' ({client})', '').replace('{client}', '') })}
                    number={null}
                    planned={false}
                    money={money}
                    startEditing
                    onSave={(patch) => {
                      addEntries([createEntry({ ...patch, source: 'manual' })]);
                      setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                  />
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-50 font-semibold text-slate-900">
                    <td />
                    <td className="px-4 py-3">{t('Total {year}', { year })}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(booked.products)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(booked.services)}</td>
                    <td className="bg-indigo-50 px-4 py-3 text-right tabular-nums text-indigo-700">{money(booked.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {(rows.length > 0 || adding) && !adding && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setAdding(true)}>
              {t('Add entry')}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Section title={t('Taxpayer details and settings')} icon="settings" description={book.header.business || t('Printed at the top of the book')} collapsible defaultOpen={!book.header.business}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['pib', 'PIB'],
                ['taxpayer', t('Taxpayer (name and surname)')],
                ['business', t('Business name')],
                ['seat', t('Registered seat')],
                ['taxpayerCode', t('Taxpayer code')],
                ['activity', t('Activity code')]
              ] as [keyof KpoBook['header'], string][]
            ).map(([field, label]) => (
              <TextField key={field} label={label} value={book.header[field]} onChange={(value) => update({ header: { ...book.header, [field]: value } })} />
            ))}
            <SelectField
              label={t('Book currency')}
              value={book.currency}
              onChange={(value) => update({ currency: value as KpoBook['currency'] })}
              options={[
                { value: 'EUR', label: t('Euro (EUR)') },
                { value: 'RSD', label: t('Dinar (RSD) — official form') }
              ]}
              hint={t('Invoices in another currency are converted with the NBS middle rate on the booking date.')}
            />
            <SelectField
              label={t('Book invoices on')}
              value={book.bookOn}
              onChange={(value) => update({ bookOn: value as KpoBook['bookOn'] })}
              options={[
                { value: 'paid', label: t('The day they are paid') },
                { value: 'issued', label: t('The day they are issued') }
              ]}
            />
            <TextField
              wrapperClassName="sm:col-span-2"
              label={t('Description for invoices')}
              value={book.entryTemplate}
              onChange={(value) => update({ entryTemplate: value })}
              hint={t('{client} becomes the client name, {number} the invoice number.')}
            />
          </div>
        </Section>
      </div>

      {/* Printable copy for the PDF export */}
      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden="true">
        <div ref={printRef}>
          <KpoPrint book={book} year={year} includePlanned={includePlanned} />
        </div>
      </div>

      {importing && <KpoImportDialog onClose={() => setImporting(false)} onImported={(importedYear) => importedYear && setYear(importedYear)} />}
    </div>
  );
};

const Card = ({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
    <div className="text-[13px] font-medium text-slate-500">{label}</div>
    <div className={`mt-1 truncate text-xl font-bold tabular-nums ${accent ? 'text-indigo-700' : 'text-slate-900'}`}>{value}</div>
    <div className="mt-0.5 text-xs text-slate-400">{detail}</div>
  </div>
);

type RowProps = {
  entry: KpoEntry;
  number: number | null;
  planned: boolean;
  money: (value: number) => string;
  onSave: (patch: Partial<KpoEntry>) => void;
  onDelete?: () => void;
  onCancel?: () => void;
  startEditing?: boolean;
};

const KpoRow = ({ entry, number, planned, money, onSave, onDelete, onCancel, startEditing = false }: RowProps) => {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState({ date: entry.date, description: entry.description, products: String(entry.products || ''), services: String(entry.services || '') });

  if (editing) {
    const products = parseAmount(draft.products) ?? 0;
    const services = parseAmount(draft.services) ?? 0;
    const valid = Boolean(draft.date && draft.description.trim());
    const save = () => {
      if (!valid) return;
      onSave({ date: draft.date, description: draft.description.trim(), products, services });
      setEditing(false);
    };
    const cancel = () => {
      setEditing(false);
      onCancel?.();
    };
    const keys = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') save();
      if (event.key === 'Escape') cancel();
    };
    return (
      <tr className="bg-indigo-50/40">
        <td className="px-4 py-2 text-center text-slate-400">{number ?? '—'}</td>
        <td className="px-2 py-2">
          <div className="flex gap-2">
            <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} onKeyDown={keys} className={`${inputClass} !w-40`} aria-label={t('Date')} />
            <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} onKeyDown={keys} className={inputClass} aria-label={t('Description')} autoFocus />
          </div>
        </td>
        <td className="px-2 py-2">
          <input value={draft.products} inputMode="decimal" placeholder="0" onChange={(event) => setDraft({ ...draft, products: event.target.value })} onKeyDown={keys} className={`${inputClass} text-right`} aria-label={t('Products')} />
        </td>
        <td className="px-2 py-2">
          <input value={draft.services} inputMode="decimal" placeholder="0" onChange={(event) => setDraft({ ...draft, services: event.target.value })} onKeyDown={keys} className={`${inputClass} text-right`} aria-label={t('Services')} />
        </td>
        <td className="px-4 py-2 text-right font-semibold tabular-nums text-indigo-700">{money(products + services)}</td>
        <td className="px-2 py-2">
          <div className="flex justify-end gap-1">
            <IconButton icon="check" label={t('Save')} onClick={save} disabled={!valid} />
            <IconButton icon="x" label={t('Cancel')} onClick={cancel} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`group transition hover:bg-slate-50 ${planned ? 'text-slate-400' : 'text-slate-700'}`} onDoubleClick={() => setEditing(true)}>
      <td className="px-4 py-2.5 text-center tabular-nums">{number ?? <span title={t('Planned')}>·</span>}</td>
      <td className="px-4 py-2.5">
        <span className={planned ? 'italic' : 'text-slate-900'}>{entry.description}</span> <span className="tabular-nums text-slate-400">{formatDateNumeric(entry.date)}</span>
        {entry.source === 'invoice' && <Icon name="file" className="ml-1.5 inline h-3.5 w-3.5 text-slate-300" />}
        {planned && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium not-italic text-slate-500">{t('Planned')}</span>}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{money(entry.products)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{money(entry.services)}</td>
      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${planned ? '' : 'bg-indigo-50/50 text-indigo-700'}`}>{money(entryTotal(entry))}</td>
      <td className="px-2 py-2.5">
        <div className="flex justify-end gap-0.5 opacity-60 transition group-hover:opacity-100">
          <IconButton icon="pen" label={t('Edit')} onClick={() => setEditing(true)} />
          {onDelete && <IconButton icon="trash" label={t('Delete')} tone="danger" onClick={onDelete} />}
        </div>
      </td>
    </tr>
  );
};

/** A4 copy of the book, used for the PDF export. */
const KpoPrint = ({ book, year, includePlanned }: { book: KpoBook; year: number; includePlanned: boolean }) => {
  const rows = bookYear(book, year).filter((row) => includePlanned || !row.planned);
  const totals = yearTotals(rows, includePlanned);
  const money = (value: number) => formatAmount(value, book.currency, 'sr-Latn-RS');
  const header: [string, string][] = [
    ['PIB', book.header.pib],
    ['Obveznik', book.header.taxpayer],
    ['Firma-radnje', book.header.business],
    ['Sedište', book.header.seat],
    ['Šifra poreskog obveznika', book.header.taxpayerCode],
    ['Šifra delatnosti', book.header.activity]
  ];
  return (
    <div data-pdf-page className="box-border w-[210mm] bg-white px-[14mm] py-[14mm] font-sans text-[10px] text-slate-900" style={{ minHeight: '297mm' }}>
      <div className="flex items-start justify-between">
        <table className="text-[10px]">
          <tbody>
            {header.map(([label, value]) => (
              <tr key={label}>
                <td className="py-0.5 pr-4 font-semibold text-slate-500">{label}:</td>
                <td className="py-0.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-2xl font-bold tracking-tight">KPO</div>
      </div>
      <h1 className="mt-6 text-center text-[13px] font-bold">KNJIGA O OSTVARENOM PROMETU PAUŠALNO OPOREZOVANIH OBVEZNIKA</h1>
      <p className="mt-1 text-center text-[10px] text-slate-500">{year}.</p>
      <table className="mt-4 w-full border-collapse text-[9.5px]">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th rowSpan={2} className="w-[12mm] border border-slate-800 px-1 py-1.5">Redni broj</th>
            <th rowSpan={2} className="border border-slate-800 px-2 py-1.5 text-left">Datum i opis knjiženja</th>
            <th colSpan={2} className="border border-slate-800 px-1 py-1">PRIHOD OD DELATNOSTI</th>
            <th rowSpan={2} className="w-[30mm] border border-slate-800 bg-slate-700 px-1 py-1.5">SVEGA PRIHODI OD DELATNOSTI (3+4)</th>
          </tr>
          <tr className="bg-slate-700 text-white">
            <th className="w-[26mm] border border-slate-800 px-1 py-1">od prodaje proizvoda</th>
            <th className="w-[26mm] border border-slate-800 px-1 py-1">od izvršenih usluga</th>
          </tr>
          <tr className="text-[8px] text-slate-400">
            {[1, 2, 3, 4, 5].map((number) => (
              <td key={number} className="border border-slate-200 text-center">
                {number}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, number, planned }, index) => (
            <tr key={entry.id} className={`${index % 2 ? 'bg-slate-50' : ''} ${planned ? 'italic text-slate-400' : ''}`}>
              <td className="border border-slate-200 px-1 py-1 text-center">{number ?? ''}</td>
              <td className="border border-slate-200 px-2 py-1">{describeWithDate(entry)}</td>
              <td className="border border-slate-200 px-2 py-1 text-right">{money(entry.products)}</td>
              <td className="border border-slate-200 px-2 py-1 text-right">{money(entry.services)}</td>
              <td className={`border border-slate-200 px-2 py-1 text-right font-semibold ${planned ? '' : 'bg-indigo-50 text-indigo-700'}`}>{money(entryTotal(entry))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800 font-bold">
            <td className="border border-slate-200" />
            <td className="border border-slate-200 px-2 py-1.5">Ukupno {year}.</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right">{money(totals.products)}</td>
            <td className="border border-slate-200 px-2 py-1.5 text-right">{money(totals.services)}</td>
            <td className="border border-slate-200 bg-indigo-50 px-2 py-1.5 text-right text-indigo-700">{money(totals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
