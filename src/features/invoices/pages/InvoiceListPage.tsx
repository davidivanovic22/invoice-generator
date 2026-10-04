import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate, todayIso } from '../../../lib/dates';
import { downloadJson } from '../../../lib/files';
import { Button, IconButton } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { inputClass } from '../../../ui/Field';
import { Icon } from '../../../ui/Icon';
import { EmptyState, Segmented } from '../../../ui/Layout';
import { formatMinor } from '../../../lib/money';
import { StatusBadge } from '../components/Status';
import { displayStatus, invoiceTotals, type DisplayStatus, type Invoice } from '../model';
import { useInvoiceStore } from '../store';

type Filter = 'all' | 'unpaid' | 'paid' | 'draft';

const matchesFilter = (status: DisplayStatus, filter: Filter) => {
  if (filter === 'all') return true;
  if (filter === 'unpaid') return status === 'sent' || status === 'overdue';
  return status === filter;
};

/** Sums per currency, e.g. "€4,200.00 + RSD 120.000,00". */
const sumByCurrency = (invoices: Invoice[]) => {
  const sums = new Map<string, number>();
  for (const invoice of invoices) sums.set(invoice.currency, (sums.get(invoice.currency) ?? 0) + invoiceTotals(invoice).totalMinor);
  if (sums.size === 0) return formatMinor(0, 'EUR');
  return Array.from(sums, ([currency, minor]) => formatMinor(minor, currency)).join(' + ');
};

export const InvoiceListPage = () => {
  const { store, createInvoice, duplicateInvoice, deleteInvoice, importBackup } = useInvoiceStore();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayIso();

  const sorted = useMemo(
    () => [...store.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)),
    [store.invoices]
  );

  const visible = sorted.filter((invoice) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      !needle || invoice.number.toLowerCase().includes(needle) || invoice.client.name.toLowerCase().includes(needle);
    return matchesQuery && matchesFilter(displayStatus(invoice, today), filter);
  });

  const unpaid = store.invoices.filter((invoice) => ['sent', 'overdue'].includes(displayStatus(invoice, today)));
  const overdue = unpaid.filter((invoice) => displayStatus(invoice, today) === 'overdue');
  const paidThisYear = store.invoices.filter((invoice) => invoice.status === 'paid' && invoice.issueDate.startsWith(today.slice(0, 4)));

  const newInvoice = () => navigate(`/invoices/${createInvoice().id}`);
  const profileMissing = !store.profile.party.name.trim();

  const handleImport = async (file: File) => {
    try {
      const summary = importBackup(JSON.parse(await file.text()));
      toast(summary.added ? `Imported ${summary.added} invoice${summary.added === 1 ? '' : 's'}` : 'Nothing new to import', 'info');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That file could not be imported.', 'error');
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    const ok = await confirm({
      title: `Delete invoice ${invoice.number}?`,
      message: 'This removes it from this browser.',
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (ok) {
      deleteInvoice(invoice.id);
      toast('Invoice deleted');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">Everything is saved in this browser. Export a backup now and then.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Button icon="download" onClick={() => downloadJson(store, `invoices-backup-${today}.json`)} disabled={!store.invoices.length}>
            Backup
          </Button>
          <Button variant="primary" icon="plus" size="lg" onClick={newInvoice}>
            New invoice
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
        <Link
          to="/profile"
          className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-sm transition hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon name="building" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Set up your business once</div>
            <div className="text-sm text-white/80">Add your company details, bank account, logo and signature. Every new invoice is then filled in for you.</div>
          </div>
          <Icon name="chevronRight" className="h-5 w-5 shrink-0" />
        </Link>
      )}

      {store.invoices.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Outstanding" value={sumByCurrency(unpaid)} detail={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? '' : 's'}`} />
          <Stat
            label="Overdue"
            value={sumByCurrency(overdue)}
            detail={overdue.length ? `${overdue.length} past the due date` : 'Nothing overdue'}
            tone={overdue.length ? 'red' : 'default'}
          />
          <Stat label={`Paid in ${today.slice(0, 4)}`} value={sumByCurrency(paidThisYear)} detail={`${paidThisYear.length} invoice${paidThisYear.length === 1 ? '' : 's'}`} />
        </div>
      )}

      {store.invoices.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="file"
            title="No invoices yet"
            description="Create your first invoice. It takes about a minute, and the next one takes seconds."
            action={
              <Button variant="primary" icon="plus" size="lg" onClick={newInvoice}>
                Create your first invoice
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
                { value: 'all', label: 'All' },
                { value: 'unpaid', label: 'Unpaid' },
                { value: 'paid', label: 'Paid' },
                { value: 'draft', label: 'Drafts' }
              ]}
            />
            <div className="relative w-full sm:w-72">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search number or client"
                aria-label="Search invoices"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
            {visible.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No invoices match.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((invoice) => (
                  <li key={invoice.id} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                    <Link to={`/invoices/${invoice.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 sm:flex">
                        {(invoice.client.name || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{invoice.client.name || 'No client yet'}</span>
                          <StatusBadge invoice={invoice} />
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-slate-500">
                          #{invoice.number} · issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                        </div>
                      </div>
                      <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900">
                        {formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency)}
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <IconButton
                        icon="copy"
                        label="Duplicate as new invoice"
                        onClick={() => {
                          const copy = duplicateInvoice(invoice.id);
                          if (copy) navigate(`/invoices/${copy.id}`);
                        }}
                      />
                      <IconButton icon="trash" label="Delete" tone="danger" onClick={() => handleDelete(invoice)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
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
