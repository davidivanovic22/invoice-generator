import { formatMoney, formatNumber } from '../../utils/currency';

type Props = {
  totalHours: number;
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  grandTotal: number;
  currency: string;
};

export const InvoiceSummary = ({
  totalHours,
  subtotal,
  vatPercent,
  vatAmount,
  grandTotal,
  currency
}: Props) => {
  return (
    <div className="mb-4 flex justify-end">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 print:max-w-[360px] print:p-3">
        <div className="flex items-center justify-between border-b border-dashed border-slate-300 py-2">
          <span className="text-sm text-slate-600">Total hours</span>
          <span className="font-semibold text-slate-900">{formatNumber(totalHours)} h</span>
        </div>

        <div className="flex items-center justify-between border-b border-dashed border-slate-300 py-2">
          <span className="text-sm text-slate-600">Subtotal</span>
          <span className="font-semibold text-slate-900">{formatMoney(subtotal, currency)}</span>
        </div>

        <div className="flex items-center justify-between border-b border-dashed border-slate-300 py-2">
          <span className="text-sm text-slate-600">VAT ({formatNumber(vatPercent)}%)</span>
          <span className="font-semibold text-slate-900">{formatMoney(vatAmount, currency)}</span>
        </div>

        <div className="flex items-center justify-between pt-3">
          <span className="text-base font-bold text-slate-900">Total to pay</span>
          <span className="text-lg font-extrabold text-slate-900">
            {formatMoney(grandTotal, currency)}
          </span>
        </div>
      </div>
    </div>
  );
};