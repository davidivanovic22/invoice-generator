import type { InvoiceEditorSettings } from '../../types/invoice';
import { InvoiceTemplateSelector } from './InvoiceTemplateSelector';

type TemplateMode = 'manual' | 'auto-season' | 'auto-month';

type TemplateKey =
  | 'winter'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'january'
  | 'february'
  | 'march'
  | 'april'
  | 'may'
  | 'june'
  | 'july'
  | 'august'
  | 'september'
  | 'october'
  | 'november'
  | 'december';

type SettingsWithTemplates = InvoiceEditorSettings & {
  templateMode?: TemplateMode;
  templateKey?: TemplateKey;
  useTemplateAccentColor?: boolean;
};

type Props = {
  settings: SettingsWithTemplates;
  issueDate: string;
  onAddText: () => void;
  onChange: <K extends keyof SettingsWithTemplates>(
    field: K,
    value: SettingsWithTemplates[K]
  ) => void;
};

const FieldLabel = ({ children }: { children: string }) => (
  <span className="mb-1 block text-xs font-medium text-slate-600">{children}</span>
);

const NumberField = ({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <FieldLabel>{label}</FieldLabel>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />
  </label>
);

export const InvoiceEditorPanel = ({
  settings,
  issueDate,
  onAddText,
  onChange
}: Props) => {
  return (
    <div className="w-full min-w-0 space-y-4">
      <InvoiceTemplateSelector
        mode={settings.templateMode ?? 'manual'}
        value={settings.templateKey ?? 'winter'}
        onModeChange={(mode) => onChange('templateMode', mode)}
        onTemplateChange={(templateKey) => onChange('templateKey', templateKey)}
      />

      {settings.templateMode && settings.templateMode !== 'manual' ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Picking the theme from issue date: <span className="font-medium text-slate-800">{issueDate}</span>
        </div>
      ) : null}

      <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Colors
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Turn this off to pick your own accent color instead of the theme's.
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
            <input
              type="checkbox"
              checked={settings.useTemplateAccentColor ?? true}
              onChange={(e) => onChange('useTemplateAccentColor', e.target.checked)}
            />
            <span className="text-sm text-slate-700">Use template accent color</span>
          </label>

          {settings.useTemplateAccentColor === false ? (
            <label className="block">
              <FieldLabel>Accent color</FieldLabel>
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => onChange('accentColor', e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 p-1"
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Text size
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Body text"
            min={10}
            max={24}
            value={settings.baseFontSize}
            onChange={(value) => onChange('baseFontSize', value)}
          />
          <NumberField
            label="Title (INVOICE)"
            min={20}
            max={72}
            value={settings.titleFontSize}
            onChange={(value) => onChange('titleFontSize', value)}
          />
        </div>
      </div>

      <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Logo & signature size
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">Logo</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Width"
                min={40}
                max={300}
                value={settings.logoWidth}
                onChange={(value) => onChange('logoWidth', value)}
              />
              <NumberField
                label="Height"
                min={40}
                max={200}
                value={settings.logoHeight}
                onChange={(value) => onChange('logoHeight', value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">Signature</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Width"
                min={80}
                max={400}
                value={settings.signatureWidth}
                onChange={(value) => onChange('signatureWidth', value)}
              />
              <NumberField
                label="Height"
                min={40}
                max={200}
                value={settings.signatureHeight}
                onChange={(value) => onChange('signatureHeight', value)}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddText}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        + Add custom text to the invoice
      </button>
    </div>
  );
};
