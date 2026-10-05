import { inputClass } from '../../../ui/Field';
import { Badge } from '../../../ui/Layout';
import { displayStatus, type Invoice, type InvoiceStatus } from '../model';
import { t } from '../../../i18n';

const LABELS = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue' } as const;
const TONES = { draft: 'slate', sent: 'indigo', paid: 'green', overdue: 'red' } as const;

export const StatusBadge = ({ invoice }: { invoice: Invoice }) => {
  const status = displayStatus(invoice);
  return <Badge tone={TONES[status]}>{t(LABELS[status])}</Badge>;
};

export const StatusMenu = ({ invoice, onChange }: { invoice: Invoice; onChange: (status: InvoiceStatus) => void }) => (
  <select
    aria-label={t('Invoice status')}
    value={invoice.status}
    onChange={(event) => onChange(event.target.value as InvoiceStatus)}
    className={`${inputClass} !w-auto !py-1.5 pr-8 text-[13px] font-medium`}
  >
    <option value="draft">{t('Draft')}</option>
    <option value="sent">{t('Sent')}</option>
    <option value="paid">{t('Paid')}</option>
  </select>
);

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

const SELECT_TONES = {
  draft: 'bg-slate-50 text-slate-700 ring-slate-200 hover:ring-slate-300',
  sent: 'bg-indigo-50 text-indigo-700 ring-indigo-200 hover:ring-indigo-300',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:ring-emerald-300',
  overdue: 'bg-red-50 text-red-700 ring-red-200 hover:ring-red-300'
} as const;

/** Compact status picker for list rows, tinted by the current status. */
export const StatusSelect = ({ invoice, onChange }: { invoice: Invoice; onChange: (status: InvoiceStatus) => void }) => (
  <select
    aria-label={t('Invoice status')}
    value={invoice.status}
    onChange={(event) => onChange(event.target.value as InvoiceStatus)}
    className={`h-8 shrink-0 cursor-pointer appearance-none rounded-lg bg-[length:14px] bg-[right_8px_center] bg-no-repeat pl-2.5 pr-7 text-[13px] font-medium outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-indigo-500 ${SELECT_TONES[displayStatus(invoice)]}`}
    style={{ backgroundImage: CHEVRON }}
  >
    <option value="draft">{t('Draft')}</option>
    <option value="sent">{t('Sent')}</option>
    <option value="paid">{t('Paid')}</option>
  </select>
);
