import { useEffect, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { Icon, type IconName } from './Icon';

type SectionProps = {
  title: string;
  description?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  id?: string;
  /** Opens a collapsible section whenever this value changes (e.g. after a click in the preview). */
  forceOpenToken?: number;
};

/** A titled card. Collapsible sections remember nothing: they open as configured. */
export const Section = ({ title, description, icon, actions, children, collapsible, defaultOpen = true, id, forceOpenToken }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (forceOpenToken) setOpen(true);
  }, [forceOpenToken]);
  const isOpen = !collapsible || open;

  const heading = (
    <div className="flex min-w-0 items-center gap-3">
      {icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon name={icon} />
        </span>
      )}
      <div className="min-w-0 text-left">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 truncate text-[13px] text-slate-500">{description}</p>}
      </div>
    </div>
  );

  return (
    <section id={id} className="scroll-mt-20 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={isOpen}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            {heading}
            <Icon
              name="chevronDown"
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        ) : (
          heading
        )}
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {isOpen && <div className="border-t border-slate-100 px-5 py-5">{children}</div>}
    </section>
  );
};

/** "Show more fields" link for progressive disclosure: optional fields stay out of the way until needed. */
export const MoreToggle = ({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className="flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 transition hover:text-indigo-800"
  >
    <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    {open ? t('Fewer details') : label}
  </button>
);

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  size?: 'sm' | 'md';
};

export const Segmented = <T extends string>({ value, onChange, options, label, size = 'md' }: SegmentedProps<T>) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          className={`rounded-md font-medium transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'} ${
            active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

type ChipsProps = {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
};

export const Chips = ({ options, value, onChange }: ChipsProps) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
            active
              ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
              : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export const SWATCHES = ['#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#0f172a'];

type SwatchesProps = { value: string; onChange: (value: string) => void; colors?: string[] };

export const Swatches = ({ value, onChange, colors = SWATCHES }: SwatchesProps) => (
  <div className="flex flex-wrap items-center gap-2">
    {colors.map((color) => {
      const active = color.toLowerCase() === value.toLowerCase();
      return (
        <button
          key={color}
          type="button"
          aria-label={t('Colour {color}', { color })}
          aria-pressed={active}
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full ring-offset-2 transition ${active ? 'ring-2 ring-slate-900' : 'hover:scale-110'}`}
          style={{ backgroundColor: color }}
        />
      );
    })}
    <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] ring-offset-2 hover:scale-110" title={t('Custom colour')}>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t('Custom colour')}
      />
    </label>
  </div>
);

type BadgeTone = 'slate' | 'green' | 'amber' | 'red' | 'indigo';
const badgeTones: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  indigo: 'bg-indigo-50 text-indigo-700'
};

export const Badge = ({ tone = 'slate', children }: { tone?: BadgeTone; children: ReactNode }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTones[tone]}`}>{children}</span>
);

export const EmptyState = ({
  icon,
  title,
  description,
  action
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
      <Icon name={icon} className="h-6 w-6" />
    </span>
    <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
