import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, IconButton } from '../../../ui/Button';
import { inputClass, NumberField } from '../../../ui/Field';
import { Section } from '../../../ui/Layout';
import { formatMinor } from '../../../lib/money';
import { createLineItem, invoiceTotals, UNITS, type Invoice, type LineItem } from '../model';

type Props = {
  invoice: Invoice;
  defaultUnit: string;
  onChange: (update: Partial<Invoice>) => void;
};

const UNIT_LABELS: Record<string, string> = { h: 'hours', day: 'days', pcs: 'pieces', month: 'months', project: 'project', km: 'km' };

export const ItemsSection = ({ invoice, defaultUnit, onChange }: Props) => {
  const totals = invoiceTotals(invoice);
  const money = (minor: number) => formatMinor(minor, invoice.currency);
  const [focusId, setFocusId] = useState<string | null>(null);
  const titleRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focusId) return;
    titleRefs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const setItems = (items: LineItem[]) => onChange({ items });
  const update = (id: string, patch: Partial<LineItem>) =>
    setItems(invoice.items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id: string) => setItems(invoice.items.filter((item) => item.id !== id));
  const move = (index: number, delta: number) => {
    const next = [...invoice.items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setItems(next);
  };
  const add = () => {
    const last = invoice.items[invoice.items.length - 1];
    const item = createLineItem({ unit: last?.unit ?? defaultUnit, unitPrice: last?.unitPrice ?? 0 });
    setItems([...invoice.items, item]);
    setFocusId(item.id);
  };

  return (
    <Section id="items" title="Items" icon="file" description={`${invoice.items.length} item${invoice.items.length === 1 ? '' : 's'} · ${money(totals.totalMinor)}`}>
      <div className="space-y-3">
        {invoice.items.map((item, index) => (
          <div key={item.id} className="group rounded-xl bg-slate-50/70 p-3 ring-1 ring-slate-200/70">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  ref={(node) => {
                    if (node) titleRefs.current.set(item.id, node);
                    else titleRefs.current.delete(item.id);
                  }}
                  aria-label="Item name"
                  value={item.title}
                  onChange={(event) => update(item.id, { title: event.target.value })}
                  placeholder="What did you do? e.g. Website development"
                  className={`${inputClass} font-medium`}
                />
                <textarea
                  aria-label="Item description"
                  rows={1}
                  value={item.description}
                  onChange={(event) => update(item.id, { description: event.target.value })}
                  placeholder="Details (optional)"
                  className={`${inputClass} resize-none text-[13px] text-slate-600`}
                  style={{ fieldSizing: 'content' } as CSSProperties}
                />
              </div>
              <div className="flex flex-col opacity-60 transition group-hover:opacity-100">
                <IconButton icon="arrowUp" label="Move up" disabled={index === 0} onClick={() => move(index, -1)} />
                <IconButton icon="arrowDown" label="Move down" disabled={index === invoice.items.length - 1} onClick={() => move(index, 1)} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
              <NumberField
                label="Quantity"
                value={item.quantity}
                onChange={(quantity) => update(item.id, { quantity })}
                min={0}
              />
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Unit</span>
                <select
                  value={item.unit}
                  onChange={(event) => update(item.id, { unit: event.target.value })}
                  className={`${inputClass} sm:w-[92px]`}
                  aria-label="Unit"
                >
                  {(UNITS.includes(item.unit) ? UNITS : [item.unit, ...UNITS]).map((unit) => (
                    <option key={unit} value={unit}>
                      {UNIT_LABELS[unit] ?? unit}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="Price"
                value={item.unitPrice}
                onChange={(unitPrice) => update(item.id, { unitPrice })}
                suffix={invoice.currency}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && index === invoice.items.length - 1) add();
                }}
              />
              <div className="flex h-9 items-center justify-end gap-1">
                <span className="min-w-[88px] text-right text-sm font-semibold tabular-nums text-slate-900">{money(totals.linesMinor[index] ?? 0)}</span>
                <IconButton icon="trash" label="Remove item" tone="danger" onClick={() => remove(item.id)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-3 w-full border border-dashed border-slate-300 !ring-0" variant="ghost" icon="plus" onClick={add}>
        Add item
      </Button>

      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{money(totals.subtotalMinor)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-600">
          <div className="flex items-center gap-2">
            <span>VAT</span>
            <NumberField
              aria-label="VAT percent"
              value={invoice.vatPercent}
              onChange={(vatPercent) => onChange({ vatPercent })}
              min={0}
              suffix="%"
              wrapperClassName="w-24"
              className="!py-1"
            />
          </div>
          <span className="tabular-nums">{money(totals.taxMinor)}</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">{money(totals.totalMinor)}</span>
        </div>
      </div>
    </Section>
  );
};
