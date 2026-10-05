import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t, uiLocale } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { EmailDialog } from '../invoices/components/EmailDialog';
import { useInvoiceStore } from '../invoices/store';
import { useKpo } from '../kpo/store';
import { buildReminders, type Reminder } from './reminders';

const monthName = (month: number) => new Intl.DateTimeFormat(uiLocale(), { month: 'long' }).format(new Date(2000, month - 1, 1));

const Row = ({ icon, tone, children, action }: { icon: IconName; tone: 'red' | 'amber' | 'indigo'; children: ReactNode; action?: ReactNode }) => {
  const tones = { red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600', indigo: 'bg-indigo-50 text-indigo-600' };
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-700">{children}</span>
      {action}
    </li>
  );
};

/** Overdue invoices, the tax deadline, unbooked invoices and drafts waiting to be sent. */
export const RemindersPanel = () => {
  const { store } = useInvoiceStore();
  const { book } = useKpo();
  const [reminding, setReminding] = useState<string | null>(null);
  const reminders = buildReminders(store, book);
  if (!reminders.length) return null;

  const render = (reminder: Reminder) => {
    switch (reminder.kind) {
      case 'overdue':
        return (
          <Row
            key={reminder.invoiceId}
            icon="alert"
            tone="red"
            action={
              <Button size="sm" icon="mail" onClick={() => setReminding(reminder.invoiceId)}>
                {t('Send reminder')}
              </Button>
            }
          >
            <Link to={`/invoices/${reminder.invoiceId}`} className="font-medium text-slate-900 hover:underline">
              #{reminder.number}
            </Link>{' '}
            {t('for {client} is {count} day overdue|for {client} is {count} days overdue', { client: reminder.client || '—', count: reminder.days })}
          </Row>
        );
      case 'tax-due':
        return (
          <Row key="tax-due" icon="calendar" tone="amber" action={<Link to="/invoices" className="text-sm font-medium text-indigo-600 hover:underline">{t('Mark paid')}</Link>}>
            {reminder.days === 0
              ? t('Today is the deadline for the {month} flat-rate tax.', { month: monthName(reminder.month) })
              : t('The {month} flat-rate tax is due on the 15th — in {count} day.|The {month} flat-rate tax is due on the 15th — in {count} days.', { month: monthName(reminder.month), count: reminder.days })}
          </Row>
        );
      case 'tax-missing':
        return (
          <Row key="tax-missing" icon="cash" tone="indigo" action={<Link to="/invoices" className="text-sm font-medium text-indigo-600 hover:underline">{t('Enter')}</Link>}>
            {t('Enter your monthly tax for {year} to see what you really earn.', { year: reminder.year })}
          </Row>
        );
      case 'kpo':
        return (
          <Row key="kpo" icon="list" tone="indigo" action={<Link to="/kpo" className="text-sm font-medium text-indigo-600 hover:underline">{t('Open KPO')}</Link>}>
            {t('{count} invoice is not in the KPO book yet.|{count} invoices are not in the KPO book yet.', { count: reminder.count })}
          </Row>
        );
      case 'drafts':
        return (
          <Row key="drafts" icon="file" tone="indigo" action={<Link to={`/invoices/${reminder.invoiceId}`} className="text-sm font-medium text-indigo-600 hover:underline">{t('Open')}</Link>}>
            {t('{count} draft is ready to be sent.|{count} drafts are ready to be sent.', { count: reminder.count })}
          </Row>
        );
      default:
        return null;
    }
  };

  const invoice = reminding ? store.invoices.find((item) => item.id === reminding) : undefined;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-slate-900">{t('Needs your attention')}</h2>
      <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">{reminders.map(render)}</ul>
      {invoice && <EmailDialog invoice={invoice} kind="reminder" onClose={() => setReminding(null)} />}
    </section>
  );
};
