import type { InvoiceData } from '../../types/invoice';
import { Card } from '../common/Card';
import { SectionTitle } from '../common/SectionTitle';

type Props = {
  invoices: InvoiceData[];
  activeInvoiceId: string | null;
  onSelect: (invoiceId: string) => void;
};

export const InvoiceListPanel = ({
  invoices,
  activeInvoiceId,
  onSelect
}: Props) => {
  return (
    <Card>
      <SectionTitle
        title="Saved invoices"
        subtitle={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
      />

      <div className="space-y-2">
        {invoices.map((invoice) => {
          const isActive = invoice.id === activeInvoiceId;

          return (
            <button
              key={invoice.id}
              type="button"
              onClick={() => onSelect(invoice.id)}
              className={[
                'w-full rounded-xl border p-3 text-left transition',
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              ].join(' ')}
            >
              <div className="font-semibold text-slate-900">{invoice.invoiceNumber}</div>
              <div className="text-sm text-slate-500">{invoice.client.name || 'No client'}</div>
              <div className="text-xs text-slate-400">{invoice.issueDate}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};