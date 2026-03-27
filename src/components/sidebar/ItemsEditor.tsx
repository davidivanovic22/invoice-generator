import type { InvoiceItem } from '../../types/invoice';
import { formatMoney, formatNumber, toNumber } from '../../utils/currency';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { SectionTitle } from '../common/SectionTitle';
import { TextArea } from '../common/TextArea';

type Props = {
  items: InvoiceItem[];
  currency: string;
  onAdd: () => void;
  onRemove: (itemId: string) => void;
  onChange: (itemId: string, field: keyof InvoiceItem, value: string | number) => void;
};

export const ItemsEditor = ({
  items,
  currency,
  onAdd,
  onRemove,
  onChange
}: Props) => {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle title="Items" />
        <Button variant="secondary" onClick={onAdd}>
          + Add
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-800">Item #{index + 1}</div>
              <Button variant="danger" onClick={() => onRemove(item.id)}>
                Remove
              </Button>
            </div>

            <div className="space-y-3">
              <Input
                label="Service"
                value={item.serviceName}
                onChange={(e) => onChange(item.id, 'serviceName', e.target.value)}
              />
              <TextArea
                label="Description"
                rows={2}
                value={item.description}
                onChange={(e) => onChange(item.id, 'description', e.target.value)}
              />
              <Input
                label="Hours"
                type="number"
                min="0"
                step="0.01"
                value={item.hours}
                onChange={(e) => onChange(item.id, 'hours', toNumber(e.target.value))}
              />
              <Input
                label="Rate / hour"
                type="number"
                min="0"
                step="0.01"
                value={item.rate}
                onChange={(e) => onChange(item.id, 'rate', toNumber(e.target.value))}
              />

              <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                {formatNumber(item.hours)} × {formatNumber(item.rate)} ={' '}
                <span className="font-semibold text-slate-900">
                  {formatMoney(item.hours * item.rate, currency)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};