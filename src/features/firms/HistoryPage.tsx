import { useState } from 'react';
import { t, uiLocale } from '../../i18n';
import { readAudit, type AuditAction, type AuditEntry } from '../../lib/audit';
import { Icon, type IconName } from '../../ui/Icon';
import { EmptyState, Segmented } from '../../ui/Layout';
import { useFirm } from './FirmContext';

type Filter = 'all' | 'invoice' | 'kpo' | 'profile';

const ACTIONS: Record<AuditAction, { label: string; icon: IconName }> = {
  'invoice.created': { label: 'Invoice {target} created', icon: 'plus' },
  'invoice.edited': { label: 'Invoice {target} edited', icon: 'pen' },
  'invoice.status': { label: 'Invoice {target} marked as {detail}', icon: 'check' },
  'invoice.deleted': { label: 'Invoice {target} deleted', icon: 'trash' },
  'invoice.restored': { label: 'Invoice {target} restored', icon: 'undo' },
  'invoice.imported': { label: '{target} invoices imported', icon: 'upload' },
  'kpo.added': { label: 'KPO entry added: {target}', icon: 'plus' },
  'kpo.edited': { label: 'KPO entry edited: {target}', icon: 'pen' },
  'kpo.deleted': { label: 'KPO entry deleted: {target}', icon: 'trash' },
  'kpo.imported': { label: '{target} KPO entries imported', icon: 'upload' },
  'profile.edited': { label: 'Business profile edited', icon: 'building' }
};

const STATUS_NAMES: Record<string, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid' };

const describe = (entry: AuditEntry) =>
  t(ACTIONS[entry.action]?.label ?? entry.action, { target: entry.target, detail: t(STATUS_NAMES[entry.detail ?? ''] ?? entry.detail ?? '') });

/** Who changed what and when, for the open firm. */
export const HistoryPage = () => {
  const { active } = useFirm();
  const [filter, setFilter] = useState<Filter>('all');
  const entries = readAudit(active.id)
    .filter((entry) => filter === 'all' || entry.action.startsWith(filter))
    .reverse();

  const groups = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  const dayLabel = (day: string) => new Intl.DateTimeFormat(uiLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${day}T12:00:00`));
  const time = (iso: string) => new Intl.DateTimeFormat(uiLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('History of changes')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('Every change to invoices, the KPO book and the business profile of this firm, with who made it.')}</p>
      <div className="mt-5">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('All') },
            { value: 'invoice', label: t('Invoices') },
            { value: 'kpo', label: 'KPO' },
            { value: 'profile', label: t('Profile') }
          ]}
        />
      </div>
      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="list" title={t('No changes yet')} description={t('Changes appear here from now on.')} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Array.from(groups, ([day, items]) => (
            <section key={day}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 first-letter:uppercase">{dayLabel(day)}</h2>
              <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                {items.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon name={ACTIONS[entry.action]?.icon ?? 'pen'} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="text-slate-800">{describe(entry)}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {time(entry.at)}
                        {entry.who && ` · ${entry.who}`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
