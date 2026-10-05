import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { todayIso } from '../../lib/dates';
import { takeSnapshot } from '../../lib/backup';
import { DEFAULT_FIRM, firmDisplayName, firmKey } from '../../lib/firms';
import { formatAmount } from '../../lib/money';
import { writeJson } from '../../lib/storage';
import { Button, IconButton } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { createEmptyStore } from '../invoices/model';
import { useInvoiceStore } from '../invoices/store';
import { useFirm } from './FirmContext';
import { summarizeFirm, type FirmSummary } from './summary';

/** Creates a firm with its own empty data, copying invoice defaults from the current firm. */
export const NewFirmDialog = ({ onClose }: { onClose: () => void }) => {
  const { createFirm, switchFirm } = useFirm();
  const { store } = useInvoiceStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const create = () => {
    const firm = createFirm(name);
    const fresh = createEmptyStore();
    fresh.profile.party.name = name.trim();
    fresh.profile.party.taxId = taxId.trim();
    fresh.profile.defaults = { ...store.profile.defaults, numberPrefix: '' };
    writeJson(firmKey('studio.invoices.v2', firm.id), fresh);
    switchFirm(firm.id);
    onClose();
    navigate('/profile');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-firm" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="new-firm" className="text-lg font-semibold text-slate-900">
          {t('New firm')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('Each firm has its own invoices, clients, KPO book and taxes. Switch between them at the top.')}</p>
        <div className="mt-5 space-y-4">
          <TextField label={t('Firm name')} value={name} onChange={setName} placeholder="Petar Petrović PR" autoFocus onKeyDown={(event) => event.key === 'Enter' && name.trim() && create()} />
          <TextField label={t('Tax ID (PIB)')} value={taxId} onChange={setTaxId} placeholder="123456789" inputMode="numeric" />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="accent" icon="plus" onClick={create} disabled={!name.trim()}>
            {t('Create firm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

/** All firms at a glance: income, flat-rate limit, unpaid invoices, missing tax or KPO entries. */
export const FirmsPage = () => {
  const { registry, active, switchFirm, rename, remove } = useFirm();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const today = todayIso();
  const year = Number(today.slice(0, 4));

  const rows = registry.firms.map((firm) => ({
    firm,
    summary: summarizeFirm(localStorage.getItem(firmKey('studio.invoices.v2', firm.id)), localStorage.getItem(firmKey('studio.kpo.v1', firm.id)), year, today)
  }));

  const open = (id: string, to = '/overview') => {
    switchFirm(id);
    navigate(to);
  };

  const label = (firm: (typeof rows)[number]['firm'], summary: FirmSummary) => firm.name || summary.name || firmDisplayName(firm) || t('Unnamed firm');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('Firms')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('For accountants and owners of several businesses: every firm has its own invoices, KPO book and taxes.')}</p>
        </div>
        <Button variant="primary" size="lg" icon="plus" onClick={() => setCreating(true)}>
          {t('New firm')}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ firm, summary }) => {
          const isActive = firm.id === active.id;
          const share = summary.limitShare;
          const tone = share >= 1 ? 'bg-red-500' : share >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500';
          const warnings = [
            summary.overdue > 0 && t('{count} overdue invoice|{count} overdue invoices', { count: summary.overdue }),
            summary.missingFromBook > 0 && t('{count} invoice not in KPO|{count} invoices not in KPO', { count: summary.missingFromBook }),
            !summary.taxEntered && summary.invoiceCount > 0 && t('Tax for {year} not entered', { year }),
            share >= 0.8 && t('Close to the flat-rate limit')
          ].filter(Boolean) as string[];
          return (
            <div key={firm.id} className={`flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ${isActive ? 'ring-2 ring-indigo-500' : 'ring-slate-200/80'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {renaming === firm.id ? (
                    <div className="flex items-center gap-1">
                      <TextField
                        value={draftName}
                        onChange={setDraftName}
                        aria-label={t('Firm name')}
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            rename(firm.id, draftName);
                            setRenaming(null);
                          }
                          if (event.key === 'Escape') setRenaming(null);
                        }}
                      />
                      <IconButton
                        icon="check"
                        label={t('Save')}
                        onClick={() => {
                          rename(firm.id, draftName);
                          setRenaming(null);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="truncate text-base font-semibold text-slate-900">{label(firm, summary)}</div>
                  )}
                  <div className="mt-0.5 text-xs text-slate-500">
                    {summary.taxId ? `PIB ${summary.taxId}` : t('No PIB yet')} · {t('{count} invoice|{count} invoices', { count: summary.invoiceCount })}
                  </div>
                </div>
                {isActive && <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{t('Open now')}</span>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">{t('Income in {year}', { year })}</div>
                  <div className="font-semibold tabular-nums text-slate-900">{formatAmount(summary.incomeEur, 'EUR')}</div>
                  <div className="text-[11px] text-slate-400">{summary.fromBook ? t('from the KPO book') : t('from paid invoices')}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t('Unpaid')}</div>
                  <div className={`font-semibold tabular-nums ${summary.overdue ? 'text-red-600' : 'text-slate-900'}`}>{formatAmount(summary.unpaidEur, 'EUR')}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t('Flat-rate limit')}</span>
                  <span className="tabular-nums">{Math.round(share * 100)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
                </div>
              </div>

              {warnings.length > 0 ? (
                <ul className="mt-4 space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning} className="flex items-center gap-2 text-xs text-amber-700">
                      <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700">
                  <Icon name="check" className="h-3.5 w-3.5" />
                  {t('All in order')}
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                <Button size="sm" variant={isActive ? 'secondary' : 'accent'} onClick={() => open(firm.id)}>
                  {t('Open')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => open(firm.id, '/invoices')}>
                  {t('Invoices')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => open(firm.id, '/kpo')}>
                  KPO
                </Button>
                <span className="ml-auto" />
                <IconButton
                  icon="pen"
                  label={t('Rename')}
                  onClick={() => {
                    setDraftName(label(firm, summary));
                    setRenaming(firm.id);
                  }}
                />
                {firm.id !== DEFAULT_FIRM && (
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={t('Delete firm')}
                    onClick={async () => {
                      const ok = await confirm({
                        title: t('Delete "{name}"?', { name: label(firm, summary) }),
                        message: t('All its invoices and the KPO book are removed from this browser. A backup is made first (Account & backup).'),
                        confirmLabel: t('Delete firm'),
                        tone: 'danger'
                      });
                      if (!ok) return;
                      await takeSnapshot('before-restore').catch(() => null);
                      remove(firm.id);
                      toast(t('Firm deleted. It can be restored from Account & backup.'));
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <Icon name="plus" className="h-6 w-6" />
          {t('Add a firm')}
        </button>
      </div>
      {creating && <NewFirmDialog onClose={() => setCreating(false)} />}
    </div>
  );
};
