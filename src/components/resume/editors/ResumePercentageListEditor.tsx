import { AccordionSection } from '../../common/AcordionSection';

export type PercentageListItem = {
  id: string;
  name: string;
  percent: number;
};

type Props = {
  id: string;
  title: string;
  itemLabel: string;
  items: PercentageListItem[];
  namePlaceholder?: string;
  addButtonLabel?: string;
  emptyStateText?: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onChange: (
    index: number,
    field: keyof Omit<PercentageListItem, 'id'>,
    value: string | number
  ) => void;
  onRemove: (index: number) => void;
};

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

const normalizeName = (value: string) =>
  value.replace(/\s+/g, ' ').trimStart();

export const ResumePercentageListEditor = ({
  id,
  title,
  itemLabel,
  items,
  namePlaceholder = 'Enter value',
  addButtonLabel,
  emptyStateText,
  isOpen,
  onToggle,
  onAdd,
  onChange,
  onRemove
}: Props) => {
  const hasItems = items.length > 0;

  return (
    <AccordionSection
      id={id}
      title={title}
      isOpen={isOpen}
      onToggle={onToggle}
      badge={
        hasItems ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {items.length}
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        {hasItems ? (
          <div className="space-y-3">
            {items.map((item, index) => {
              const safePercent = clampPercent(item.percent);

              return (
                <div
                  key={item.id || `${id}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {itemLabel} {index + 1}
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {itemLabel} name
                      </label>

                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          onChange(index, 'name', normalizeName(e.target.value))
                        }
                        placeholder={namePlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Percent
                      </label>

                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={safePercent}
                        onChange={(e) =>
                          onChange(
                            index,
                            'percent',
                            clampPercent(Number(e.target.value))
                          )
                        }
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={safePercent}
                      onChange={(e) =>
                        onChange(
                          index,
                          'percent',
                          clampPercent(Number(e.target.value))
                        )
                      }
                      className="w-full"
                    />

                    <div className="mt-1 text-xs text-slate-500">
                      Current value: {safePercent}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            {emptyStateText ?? `No ${title.toLowerCase()} added yet.`}
          </div>
        )}

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {addButtonLabel ?? `Add ${itemLabel.toLowerCase()}`}
        </button>
      </div>
    </AccordionSection>
  );
};