import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { t, uiLocale } from '../../../i18n';
import { formatDate, todayIso } from '../../../lib/dates';
import { downloadJson } from '../../../lib/files';
import { formatAmount, formatMinor } from '../../../lib/money';
import { Button } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { inputClass } from '../../../ui/Field';
import { Icon } from '../../../ui/Icon';
import { EmptyState, Segmented } from '../../../ui/Layout';
import { Menu } from '../../../ui/Menu';
import { EmailDialog } from '../components/EmailDialog';
import { exportForAccountant } from '../exportAccountant';
import { StatusBadge, StatusSelect } from '../components/Status';
import { YearTaxDialog } from '../components/YearTaxDialog';
import { displayStatus, invoiceTotals, paidIncomeEur, paidTaxMonths, taxSpentEur, type DisplayStatus, type Invoice } from '../model';
import { QuickInvoiceDialog } from '../QuickInvoiceDialog';
import { useInvoiceStore } from '../store';
import { bookYear, yearTotals } from '../../kpo/model';
import { useKpo } from '../../kpo/store';

type Filter = 'all' | 'unpaid' | 'paid' | 'draft';
type Sort = 'newest' | 'oldest' | 'number' | 'amount' | 'client';

const SORT_KEY = 'studio.invoices.sort';
const SORTS: Sort[] = ['newest', 'oldest', 'number', 'amount', 'client'];

const readSort = (): Sort => {
  try {
    const saved = localStorage.getItem(SORT_KEY) as Sort | null;
    return saved && SORTS.includes(saved) ? saved : 'newest';
  } catch {
    return 'newest';
  }
};

const byNewest = (a: Invoice, b: Invoice) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number, undefined, { numeric: true });

export const sortInvoices = (invoices: Invoice[], sort: Sort) => {
  const list = [...invoices];
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => byNewest(b, a));
    case 'number':
      return list.sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }));
    case 'amount':
      return list.sort((a, b) => invoiceTotals(b).totalMinor - invoiceTotals(a).totalMinor || byNewest(a, b));
    case 'client':
      return list.sort((a, b) => a.client.name.localeCompare(b.client.name, uiLocale(), { sensitivity: 'base' }) || byNewest(a, b));
    default:
      return list.sort(byNewest);
  }
};

const matchesFilter = (status: DisplayStatus, filter: Filter) => {
  if (filter === 'all') return true;
  if (filter === 'unpaid') return status === 'sent' || status === 'overdue';
  return status === filter;
};

/** Sums per currency, e.g. "€4,200.00 + RSD 120.000,00". */
export const sumByCurrency = (invoices: Invoice[]) => {
  const sums = new Map<string, number>();
  for (const invoice of invoices) sums.set(invoice.currency, (sums.get(invoice.currency) ?? 0) + invoiceTotals(invoice).totalMinor);
  if (sums.size === 0) return formatMinor(0, 'EUR');
  return Array.from(sums, ([currency, minor]) => formatMinor(minor, currency)).join(' + ');
};

export const InvoiceListPage = () => {
  const { store, duplicateInvoice, deleteInvoice, restoreInvoice, importBackup, setStatus, updateProfile } = useInvoiceStore();
  const [editingTax, setEditingTax] = useState(false);
  const { book } = useKpo();
  const [reminding, setReminding] = useState<Invoice | null>(null);
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSortState] = useState<Sort>(readSort);
  const setSort = (next: Sort) => {
    setSortState(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Sorting still works for this visit.
    }
  };
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // ?new=1 (from the command palette) opens the new-invoice dialog.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setCreating(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const today = todayIso();

  const sorted = useMemo(() => sortInvoices(store.invoices, sort), [store.invoices, sort]);

  const handleDuplicate = (invoice: Invoice) => {
    const copy = duplicateInvoice(invoice.id);
    if (!copy) return;
    toast(t('Created invoice {number}', { number: copy.number }));
    navigate(`/invoices/${copy.id}`);
  };

  const visible = sorted.filter((invoice) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || invoice.number.toLowerCase().includes(needle) || invoice.client.name.toLowerCase().includes(needle);
    return matchesQuery && matchesFilter(displayStatus(invoice, today), filter);
  });

  const unpaid = store.invoices.filter((invoice) => ['sent', 'overdue'].includes(displayStatus(invoice, today)));
  const overdue = unpaid.filter((invoice) => displayStatus(invoice, today) === 'overdue');
  const paidThisYear = store.invoices.filter((invoice) => invoice.status === 'paid' && invoice.issueDate.startsWith(today.slice(0, 4)));
  const profileMissing = !store.profile.party.name.trim();
  const year = Number(today.slice(0, 4));
  const yearTax = store.profile.yearlyTax[String(year)];
  const taxSpent = taxSpentEur(yearTax, year);
  const invoicePaidEur = paidIncomeEur(store.invoices, year, yearTax?.rsdPerEur ?? 117.2);
  // When the year has a KPO book, it is the record (the same numbers as Overview and KPO).
  const kpoRows = bookYear(book, year, today).filter((row) => !row.planned);
  const kpoTotal = yearTotals(kpoRows).total;
  const useBook = kpoRows.length > 0;
  const paidEur = useBook ? { total: book.currency === 'EUR' ? kpoTotal : kpoTotal / (yearTax?.rsdPerEur || 117.2), skipped: 0 } : invoicePaidEur;

  const handleImport = async (file: File) => {
    try {
      const summary = importBackup(JSON.parse(await file.text()));
      toast(summary.added ? t('Imported {count} invoice|Imported {count} invoices', { count: summary.added }) : t('Nothing new to import'), 'info');
    } catch (error) {
      toast(error instanceof Error ? error.message : t('That file could not be imported.'), 'error');
    }
  };

  const handleDelete = (invoice: Invoice) => {
    const removed = deleteInvoice(invoice.id);
    if (removed) toast(t('Invoice {number} deleted', { number: removed.number }), 'success', { label: t('Undo'), onClick: () => restoreInvoice(removed) });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('Invoices')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('Everything is saved in this browser. Download a backup now and then.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Menu
            label={t('Backup and restore')}
            items={[
              ...[year, year - 1].map((exportYear) => ({
                label: t('Excel for the accountant ({year})', { year: exportYear }),
                icon: 'list' as const,
                onSelect: async () => {
                  const count = await exportForAccountant(store, exportYear);
                  if (!count) toast(t('No issued invoices in {year}.', { year: exportYear }), 'info');
                }
              })),
              'divider' as const,
              { label: t('Download backup'), icon: 'download', onSelect: () => downloadJson(store, `invoices-backup-${today}.json`), disabled: !store.invoices.length },
              { label: t('Restore from backup'), icon: 'upload', onSelect: () => fileRef.current?.click() },
              { label: t('Business profile'), icon: 'building', onSelect: () => navigate('/profile') }
            ]}
          />
          <Button variant="primary" icon="plus" size="lg" onClick={() => setCreating(true)}>
            {t('New invoice')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImport(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {profileMissing && (
        <Link to="/profile" className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-sm transition hover:shadow-md">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon name="building" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t('Set up your business once')}</div>
            <div className="text-sm text-white/80">{t('Add your company details, bank account, logo and signature. Every new invoice is then filled in for you.')}</div>
          </div>
          <Icon name="chevronRight" className="h-5 w-5 shrink-0" />
        </Link>
      )}

      {store.invoices.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
          <Stat label={t('Outstanding')} value={sumByCurrency(unpaid)} detail={t('{count} unpaid invoice|{count} unpaid invoices', { count: unpaid.length })} />
          <Stat
            label={t('Overdue')}
            value={sumByCurrency(overdue)}
            detail={overdue.length ? t('{count} past the due date', { count: overdue.length }) : t('Nothing overdue')}
            tone={overdue.length ? 'red' : 'default'}
          />
          {useBook ? (
            <Stat
              label={t('Paid in {year}', { year: today.slice(0, 4) })}
              value={formatAmount(kpoTotal, book.currency)}
              detail={t('From the KPO book · {count} entry|From the KPO book · {count} entries', { count: kpoRows.length })}
            />
          ) : (
            <Stat label={t('Paid in {year}', { year: today.slice(0, 4) })} value={sumByCurrency(paidThisYear)} detail={t('{count} invoice|{count} invoices', { count: paidThisYear.length })} />
          )}
          <button
            type="button"
            onClick={() => setEditingTax(true)}
            className="group rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/80 transition hover:ring-indigo-300"
            title={t('Edit the tax for {year}', { year })}
          >
            <div className="flex items-center justify-between text-[13px] font-medium text-slate-500">
              {t('Tax in {year}', { year })}
              <Icon name="pen" className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-indigo-500" />
            </div>
            {yearTax ? (
              <>
                <div className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900">{formatAmount(taxSpent, 'EUR')}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {t('{months} × {monthly}', { months: paidTaxMonths(yearTax, year).length, monthly: formatAmount(yearTax.monthly, yearTax.currency) })}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-sm font-semibold text-indigo-600">{t('Enter your tax')}</div>
                <div className="mt-0.5 text-xs text-slate-400">{t('e.g. 400 € per month')}</div>
              </>
            )}
          </button>
          <Stat
            label={t('Earned after tax in {year}', { year })}
            value={formatAmount(paidEur.total - taxSpent, 'EUR')}
            detail={paidEur.skipped ? t('{count} invoice in another currency is not included.|{count} invoices in other currencies are not included.', { count: paidEur.skipped }) : t('Paid minus tax')}
            tone={paidEur.total - taxSpent < 0 ? 'red' : 'green'}
          />
        </div>
      )}

      {store.invoices.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="file"
            title={t('No invoices yet')}
            description={t('Create your first invoice. It takes about a minute, and the next one takes seconds.')}
            action={
              <Button variant="primary" icon="plus" size="lg" onClick={() => setCreating(true)}>
                {t('Create your first invoice')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('All') },
                { value: 'unpaid', label: t('Unpaid') },
                { value: 'paid', label: t('Paid') },
                { value: 'draft', label: t('Drafts') }
              ]}
            />
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-[13px] text-slate-500">
                <span className="shrink-0">{t('Sort')}</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label={t('Sort invoices')} className={`${inputClass} sm:w-48`}>
                  <option value="newest">{t('Newest first')}</option>
                  <option value="oldest">{t('Oldest first')}</option>
                  <option value="number">{t('By number')}</option>
                  <option value="amount">{t('By amount')}</option>
                  <option value="client">{t('By client (A–Z)')}</option>
                </select>
              </label>
              <div className="relative w-full sm:w-72">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search number or client')} aria-label={t('Search invoices')} className={`${inputClass} pl-9`} />
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
            {visible.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">{t('No invoices match.')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((invoice) => {
                  const status = displayStatus(invoice, today);
                  return (
                    // Phones: name and amount on the first line, status and actions on the second.
                    <li key={invoice.id} className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 transition hover:bg-slate-50 sm:flex-nowrap sm:px-5">
                      <Link to={`/invoices/${invoice.id}`} className="flex min-w-0 basis-full items-center gap-4 sm:flex-1 sm:basis-auto">
                        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 sm:flex">
                          {(invoice.client.name || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-slate-900">{invoice.client.name || t('No client yet')}</span>
                            {status === 'overdue' && <StatusBadge invoice={invoice} />}
                            {invoice.repeatDay && (
                              <span title={t('Repeats every month')} className="text-indigo-500">
                                <Icon name="refresh" className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-[13px] text-slate-500">
                            #{invoice.number} · {t('issued {date}', { date: formatDate(invoice.issueDate, uiLocale()) })} ·{' '}
                            {t('due {date}', { date: formatDate(invoice.dueDate, uiLocale()) })}
                          </div>
                        </div>
                        <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900">{formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency)}</span>
                      </Link>
                      <span className="ml-auto sm:ml-0" />
                      <StatusSelect invoice={invoice} onChange={(next) => setStatus(invoice.id, next)} />
                      <Button size="sm" icon="copy" title={t('Duplicate as new invoice')} aria-label={t('Duplicate as new invoice')} onClick={() => handleDuplicate(invoice)}>
                        <span className="hidden sm:inline">{t('Duplicate')}</span>
                      </Button>
                      <Menu
                        label={t('Invoice options')}
                        items={[
                          { label: t('Open'), icon: 'pen', onSelect: () => navigate(`/invoices/${invoice.id}`) },
                          {
                            label: t('Duplicate as new invoice'),
                            icon: 'copy',
                            onSelect: () => handleDuplicate(invoice)
                          },
                          status === 'paid'
                            ? { label: t('Mark as unpaid'), icon: 'refresh', onSelect: () => setStatus(invoice.id, 'sent') }
                            : { label: t('Mark as paid'), icon: 'check', onSelect: () => setStatus(invoice.id, 'paid') },
                          ...(status === 'draft' ? [{ label: t('Mark as sent'), icon: 'mail' as const, onSelect: () => setStatus(invoice.id, 'sent') }] : []),
                          ...(status === 'sent' || status === 'overdue' ? [{ label: t('Send payment reminder'), icon: 'alert' as const, onSelect: () => setReminding(invoice) }] : []),
                          'divider',
                          { label: t('Delete'), icon: 'trash', danger: true, onSelect: () => handleDelete(invoice) }
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {creating && <QuickInvoiceDialog onClose={() => setCreating(false)} />}
      {reminding && <EmailDialog invoice={reminding} kind="reminder" onClose={() => setReminding(null)} />}
      {editingTax && (
        <YearTaxDialog
          year={year}
          value={yearTax}
          onClose={() => setEditingTax(false)}
          onSave={(tax) =>
            updateProfile((profile) => {
              const yearlyTax = { ...profile.yearlyTax };
              if (tax) yearlyTax[String(year)] = tax;
              else delete yearlyTax[String(year)];
              return { ...profile, yearlyTax };
            })
          }
        />
      )}
    </div>
  );
};

const Stat = ({ label, value, detail, tone = 'default' }: { label: string; value: string; detail: string; tone?: 'default' | 'red' | 'green' }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
    <div className="text-[13px] font-medium text-slate-500">{label}</div>
    <div className={`mt-1 truncate text-xl font-bold tabular-nums ${tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div>
    <div className="mt-0.5 text-xs text-slate-400">{detail}</div>
  </div>
);
