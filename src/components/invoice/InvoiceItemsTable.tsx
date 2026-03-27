import type { InvoiceItem } from '../../types/invoice';
import { formatMoney, formatNumber } from '../../utils/currency';

type Props = {
  items: InvoiceItem[];
  currency: string;
};

export const InvoiceItemsTable = ({ items, currency }: Props) => {
  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full border-collapse">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700">#</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700">Service</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700">Description</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700">Hours</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700">Rate</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700">Amount</th>
          </tr>
        </thead>

        <tbody className="bg-white">
          {items.map((item, index) => (
            <tr key={item.id} className="border-t border-slate-200 align-top">
              <td className="px-3 py-3 text-sm text-slate-700">{index + 1}</td>
              <td className="px-3 py-3 text-sm font-semibold text-slate-900">
                {item.serviceName}
              </td>
              <td className="px-3 py-3 text-sm text-slate-600">{item.description}</td>
              <td className="px-3 py-3 text-sm text-slate-700">{formatNumber(item.hours)}</td>
              <td className="px-3 py-3 text-sm text-slate-700">
                {formatMoney(item.rate, currency)}
              </td>
              <td className="px-3 py-3 text-sm font-semibold text-slate-900">
                {formatMoney(item.hours * item.rate, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};