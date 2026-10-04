import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { t, uiLocale } from '../../i18n';
import { formatDate, todayIso } from '../../lib/dates';
import { formatMinor } from '../../lib/money';
import { Icon, type IconName } from '../../ui/Icon';
import { useAi } from '../ai/AiSettings';
import { StatusBadge } from '../invoices/components/Status';
import { displayStatus, invoiceTotals } from '../invoices/model';
import { sumByCurrency } from '../invoices/pages/InvoiceListPage';
import { QuickInvoiceDialog, recurringInvoices } from '../invoices/QuickInvoiceDialog';
import { useInvoiceStore } from '../invoices/store';
import { NewResumeDialog } from '../resumes/NewResumeDialog';
import { useResumeStore } from '../resumes/store';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
};

const ActionCard = ({ icon, title, text, onClick, accent }: { icon: IconName; title: string; text: string; onClick: () => void; accent: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300"
  >
    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm ${accent}`}>
      <Icon name={icon} className="h-6 w-6" />
    </span>
    <span>
      <span className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
        {title}
        <Icon name="chevronRight" className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
      </span>
      <span className="mt-1 block text-sm text-slate-500">{text}</span>
    </span>
  </button>
);

export const HomePage = () => {
  const { store: invoices, duplicateInvoice } = useInvoiceStore();
  const { store: resumes } = useResumeStore();
  const { hasKey, openSettings } = useAi();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | 'invoice' | 'resume' | 'import'>(null);
  const today = todayIso();

  const recurring = useMemo(() => recurringInvoices(invoices, 3), [invoices]);
  const unpaid = invoices.invoices.filter((invoice) => ['sent', 'overdue'].includes(displayStatus(invoice, today)));
  const profile = invoices.profile;

  const checklist = [
    { done: Boolean(profile.party.name && profile.bank.iban), label: t('Add your business details and bank account'), to: '/profile' },
    { done: Boolean(profile.logo || profile.signature), label: t('Add your logo or signature'), to: '/profile' },
    { done: hasKey, label: t('Connect Claude AI (optional)'), action: openSettings },
    { done: invoices.invoices.length > 0 || resumes.resumes.length > 0, label: t('Create your first document'), action: () => setDialog('invoice') }
  ];
  const remaining = checklist.filter((item) => !item.done).length;

  const recent = useMemo(
    () =>
      [
        ...invoices.invoices.map((invoice) => ({ kind: 'invoice' as const, id: invoice.id, updatedAt: invoice.updatedAt, invoice })),
        ...resumes.resumes.map((resume) => ({ kind: 'resume' as const, id: resume.id, updatedAt: resume.updatedAt, resume }))
      ]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [invoices.invoices, resumes.resumes]
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{greeting()}</h1>
      <p className="mt-1 text-slate-500">{t('What would you like to do?')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ActionCard icon="file" title={t('New invoice')} text={t('Ready in under a minute. Your details are filled in.')} onClick={() => setDialog('invoice')} accent="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <ActionCard icon="user" title={t('New resume')} text={t('Start from an example or from scratch.')} onClick={() => setDialog('resume')} accent="bg-gradient-to-br from-sky-500 to-cyan-600" />
        <ActionCard icon="sparkle" title={t('Improve my CV')} text={t('Upload your CV. AI checks it and fixes it step by step.')} onClick={() => setDialog('import')} accent="bg-gradient-to-br from-amber-400 to-orange-500" />
      </div>

      {recurring.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900">{t('Invoice again, one click')}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {recurring.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => {
                  const copy = duplicateInvoice(invoice.id);
                  if (copy) navigate(`/invoices/${copy.id}`);
                }}
                className="flex items-center gap-2 rounded-full bg-white py-2 pl-2 pr-4 text-sm shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Icon name="refresh" className="h-3.5 w-3.5" />
                </span>
                <span className="font-medium text-slate-900">{invoice.client.name}</span>
                <span className="text-slate-500">{formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t('Recent')}</h2>
            {unpaid.length > 0 && (
              <Link to="/invoices" className="text-[13px] font-medium text-slate-500 hover:text-slate-900">
                {t('Outstanding')}: <span className="font-semibold text-slate-900">{sumByCurrency(unpaid)}</span>
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center text-sm text-slate-500">
              {t('Your invoices and resumes will appear here.')}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
              {recent.map((entry) => (
                <li key={`${entry.kind}-${entry.id}`}>
                  <Link to={`/${entry.kind === 'invoice' ? 'invoices' : 'resumes'}/${entry.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${entry.kind === 'invoice' ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-sky-600'}`}>
                      <Icon name={entry.kind === 'invoice' ? 'file' : 'user'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {entry.kind === 'invoice' ? entry.invoice.client.name || t('No client yet') : entry.resume.name}
                        </span>
                        {entry.kind === 'invoice' && <StatusBadge invoice={entry.invoice} />}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {entry.kind === 'invoice'
                          ? `${t('Invoice')} #${entry.invoice.number} · ${formatMinor(invoiceTotals(entry.invoice).totalMinor, entry.invoice.currency)}`
                          : `${t('Resume')} · ${entry.resume.personal.fullName || '—'}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDate(entry.updatedAt.slice(0, 10), uiLocale())}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {remaining > 0 && (
          <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t('Get set up')}</h2>
              <span className="text-xs text-slate-400">
                {checklist.length - remaining}/{checklist.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((checklist.length - remaining) / checklist.length) * 100}%` }} />
            </div>
            <ul className="mt-4 space-y-1">
              {checklist.map((item) => {
                const content = (
                  <>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-emerald-500 text-white' : 'ring-2 ring-inset ring-slate-300'}`}>
                      {item.done && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className={`text-sm ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</span>
                  </>
                );
                const className = 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50';
                return (
                  <li key={item.label}>
                    {item.to ? (
                      <Link to={item.to} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={item.action} className={className}>
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>

      {dialog === 'invoice' && <QuickInvoiceDialog onClose={() => setDialog(null)} />}
      {(dialog === 'resume' || dialog === 'import') && <NewResumeDialog startWithImport={dialog === 'import'} onClose={() => setDialog(null)} />}
    </div>
  );
};
