import type {
  InvoiceTemplateKey,
  InvoiceTemplateMode
} from '../../types/invoice-template';
import { INVOICE_TEMPLATES } from '../../utils/invoiceTemplates';

type Props = {
  mode?: InvoiceTemplateMode;
  value?: InvoiceTemplateKey;
  onModeChange: (mode: InvoiceTemplateMode) => void;
  onTemplateChange: (templateKey: InvoiceTemplateKey) => void;
};

const manualTemplateGroups: Array<{
  title: string;
  keys: InvoiceTemplateKey[];
}> = [
  {
    title: 'Seasons',
    keys: ['winter', 'spring', 'summer', 'autumn']
  },
  {
    title: 'Months',
    keys: [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december'
    ]
  }
];

export const InvoiceTemplateSelector = ({
  mode = 'manual',
  value = 'winter',
  onModeChange,
  onTemplateChange
}: Props) => {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Theme selector
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Choose invoice theme by season or month.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => onModeChange('manual')}
          className={`rounded-xl border px-4 py-3 text-left transition ${
            mode === 'manual'
              ? 'border-slate-900 bg-slate-50 shadow-sm'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="font-semibold text-slate-900">Manual template</div>
          <div className="mt-1 text-sm text-slate-500">
            Pick any season or month template manually.
          </div>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('auto-season')}
          className={`rounded-xl border px-4 py-3 text-left transition ${
            mode === 'auto-season'
              ? 'border-slate-900 bg-slate-50 shadow-sm'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="font-semibold text-slate-900">Auto by season</div>
          <div className="mt-1 text-sm text-slate-500">
            Theme changes automatically from issue date.
          </div>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('auto-month')}
          className={`rounded-xl border px-4 py-3 text-left transition ${
            mode === 'auto-month'
              ? 'border-slate-900 bg-slate-50 shadow-sm'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="font-semibold text-slate-900">Auto by month</div>
          <div className="mt-1 text-sm text-slate-500">
            Uses a dedicated theme for each month.
          </div>
        </button>
      </div>

      {mode === 'manual' && (
        <div className="mt-5 space-y-5">
          {manualTemplateGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-sm font-semibold text-slate-700">{group.title}</div>

              <div className="grid grid-cols-2 gap-3">
                {group.keys.map((key) => {
                  const template = INVOICE_TEMPLATES[key];
                  const isActive = value === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTemplateChange(key)}
                      className={`min-w-0 rounded-2xl border p-3 text-left transition ${
                        isActive ? 'shadow-md' : 'hover:shadow-sm'
                      }`}
                      style={{
                        borderColor: isActive ? template.accentColor : template.borderColor,
                        background: template.headerGradient
                      }}
                    >
                      <div
                        className="mb-3 h-2 w-full rounded-full"
                        style={{ background: template.accentColor }}
                      />

                      <div className="truncate text-sm font-semibold text-slate-900">
                        {template.label}
                      </div>

                      <div className="mt-3 flex gap-1.5">
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{
                            background: template.surfaceAlt,
                            borderColor: template.borderColor
                          }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{
                            background: template.tableHeaderBackground,
                            borderColor: template.borderColor
                          }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border"
                          style={{
                            background: template.totalCardBackground,
                            borderColor: template.borderColor
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};