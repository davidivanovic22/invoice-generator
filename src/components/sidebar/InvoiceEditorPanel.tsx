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

      <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Editor
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Issue date: <span className="font-medium text-slate-800">{issueDate}</span>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
            <input
              type="checkbox"
              checked={settings.useTemplateAccentColor ?? true}
              onChange={(e) => onChange('useTemplateAccentColor', e.target.checked)}
            />
            <span className="text-sm text-slate-700">Use template accent color</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Base font size
            </span>
            <input
              type="number"
              min={10}
              max={24}
              value={settings.baseFontSize}
              onChange={(e) => onChange('baseFontSize', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Title font size
            </span>
            <input
              type="number"
              min={20}
              max={72}
              value={settings.titleFontSize}
              onChange={(e) => onChange('titleFontSize', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Accent color
            </span>
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => onChange('accentColor', e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 p-1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Logo width
            </span>
            <input
              type="number"
              min={40}
              max={300}
              value={settings.logoWidth}
              onChange={(e) => onChange('logoWidth', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Logo height
            </span>
            <input
              type="number"
              min={40}
              max={200}
              value={settings.logoHeight}
              onChange={(e) => onChange('logoHeight', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Signature width
            </span>
            <input
              type="number"
              min={80}
              max={400}
              value={settings.signatureWidth}
              onChange={(e) => onChange('signatureWidth', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Signature height
            </span>
            <input
              type="number"
              min={40}
              max={200}
              value={settings.signatureHeight}
              onChange={(e) => onChange('signatureHeight', Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <button
            type="button"
            onClick={onAddText}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
          >
            Add text element
          </button>
        </div>
      </div>
    </div>
  );
};