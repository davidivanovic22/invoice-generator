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
