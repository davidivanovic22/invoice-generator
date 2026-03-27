import type { InvoiceData } from '../../types/invoice';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { TextArea } from '../common/TextArea';
import { SectionTitle } from '../common/SectionTitle';

type Props = {
  invoice: InvoiceData;
  onChange: <K extends keyof Omit<
    InvoiceData,
    'id' | 'issuer' | 'client' | 'items' | 'createdAt' | 'updatedAt'
  >>(
    field: K,
    value: InvoiceData[K]
  ) => void;
};

export const InvoiceMetaForm = ({ invoice, onChange }: Props) => {
  return (
    <Card>
      <SectionTitle title="Invoice" />

      <div className="space-y-3">
        <Input
          label="Invoice number"
          value={invoice.invoiceNumber}
          onChange={(e) => onChange('invoiceNumber', e.target.value)}
        />
        <Input
          label="Billing period"
          value={invoice.billingPeriod}
          onChange={(e) => onChange('billingPeriod', e.target.value)}
        />
        <Input
          label="Issue date"
          type="date"
          value={invoice.issueDate}
          onChange={(e) => onChange('issueDate', e.target.value)}
        />
        <Input
          label="Due date"
          type="date"
          value={invoice.dueDate}
          onChange={(e) => onChange('dueDate', e.target.value)}
        />
        <Input
          label="Currency"
          value={invoice.currency}
          onChange={(e) => onChange('currency', e.target.value.toUpperCase())}
        />
        <Input
          label="VAT %"
          type="number"
          min="0"
          step="0.01"
          value={invoice.vatPercent}
          onChange={(e) => onChange('vatPercent', Number(e.target.value))}
        />
        <TextArea
          label="Note"
          rows={3}
          value={invoice.note}
          onChange={(e) => onChange('note', e.target.value)}
        />
      </div>
    </Card>
  );
};