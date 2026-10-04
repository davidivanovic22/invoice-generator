import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { t, uiLocale } from '../../../i18n';
import { formatDate, todayIso } from '../../../lib/dates';
import { downloadJson } from '../../../lib/files';
import { formatMinor } from '../../../lib/money';
import { Button } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { inputClass } from '../../../ui/Field';
import { Icon } from '../../../ui/Icon';
import { EmptyState, Segmented } from '../../../ui/Layout';
import { Menu } from '../../../ui/Menu';
import { StatusBadge } from '../components/Status';
import { displayStatus, invoiceTotals, type DisplayStatus, type Invoice } from '../model';
import { QuickInvoiceDialog } from '../QuickInvoiceDialog';
import { useInvoiceStore } from '../store';

type Filter = 'all' | 'unpaid' | 'paid' | 'draft';

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
  const { store, duplicateInvoice, deleteInvoice, restoreInvoice, importBackup, setStatus } = useInvoiceStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
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

  const sorted = useMemo(
    () => [...store.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)),
    [store.invoices]
  );

  const visible = sorted.filter((invoice) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || invoice.number.toLowerCase().includes(needle) || invoice.client.name.toLowerCase().includes(needle);
    return matchesQuery && matchesFilter(displayStatus(invoice, today), filter);
  });

  const unpaid = store.invoices.filter((invoice) => ['sent', 'overdue'].includes(displayStatus(invoice, today)));
  const overdue = unpaid.filter((invoice) => displayStatus(invoice, today) === 'overdue');
  const paidThisYear = store.invoices.filter((invoice) => invoice.status === 'paid' && invoice.issueDate.startsWith(today.slice(0, 4)));
  const profileMissing = !store.profile.party.name.trim();

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
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label={t('Outstanding')} value={sumByCurrency(unpaid)} detail={t('{count} unpaid invoice|{count} unpaid invoices', { count: unpaid.length })} />
          <Stat
            label={t('Overdue')}
            value={sumByCurrency(overdue)}
            detail={overdue.length ? t('{count} past the due date', { count: overdue.length }) : t('Nothing overdue')}
            tone={overdue.length ? 'red' : 'default'}
          />
          <Stat label={t('Paid in {year}', { year: today.slice(0, 4) })} value={sumByCurrency(paidThisYear)} detail={t('{count} invoice|{count} invoices', { count: paidThisYear.length })} />
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
            <div className="relative w-full sm:w-72">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search number or client')} aria-label={t('Search invoices')} className={`${inputClass} pl-9`} />
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
                    <li key={invoice.id} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                      <Link to={`/invoices/${invoice.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 sm:flex">
                          {(invoice.client.name || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-slate-900">{invoice.client.name || t('No client yet')}</span>
                            <StatusBadge invoice={invoice} />
                          </div>
                          <div className="mt-0.5 truncate text-[13px] text-slate-500">
                            #{invoice.number} · {t('issued {date}', { date: formatDate(invoice.issueDate, uiLocale()) })} ·{' '}
                            {t('due {date}', { date: formatDate(invoice.dueDate, uiLocale()) })}
                          </div>
                        </div>
                        <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900">{formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency)}</span>
                      </Link>
                      {(status === 'sent' || status === 'overdue') && (
                        <Button size="sm" icon="check" className="hidden md:inline-flex" onClick={() => setStatus(invoice.id, 'paid')}>
                          {t('Mark paid')}
                        </Button>
                      )}
                      <Menu
                        label={t('Invoice options')}
                        items={[
                          { label: t('Open'), icon: 'pen', onSelect: () => navigate(`/invoices/${invoice.id}`) },
                          {
                            label: t('Duplicate as new invoice'),
                            icon: 'copy',
                            onSelect: () => {
                              const copy = duplicateInvoice(invoice.id);
                              if (copy) navigate(`/invoices/${copy.id}`);
                            }
                          },
                          status === 'paid'
                            ? { label: t('Mark as unpaid'), icon: 'refresh', onSelect: () => setStatus(invoice.id, 'sent') }
                            : { label: t('Mark as paid'), icon: 'check', onSelect: () => setStatus(invoice.id, 'paid') },
                          ...(status === 'draft' ? [{ label: t('Mark as sent'), icon: 'mail' as const, onSelect: () => setStatus(invoice.id, 'sent') }] : []),
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
    </div>
  );
};

const Stat = ({ label, value, detail, tone = 'default' }: { label: string; value: string; detail: string; tone?: 'default' | 'red' }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
    <div className="text-[13px] font-medium text-slate-500">{label}</div>
    <div className={`mt-1 truncate text-xl font-bold tabular-nums ${tone === 'red' ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
    <div className="mt-0.5 text-xs text-slate-400">{detail}</div>
  </div>
);
