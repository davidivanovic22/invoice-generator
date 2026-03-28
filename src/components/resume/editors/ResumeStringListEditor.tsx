import { AccordionSection } from '../../common/AcordionSection';

type Props = {
  id: string;
  title: string;
  items: string[];
  placeholder: string;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  isOpen: boolean;
  onToggle: (id: string) => void;
};

const normalizeValue = (value: string) => value.replace(/\s+/g, ' ').trimStart();

export const ResumeStringListEditor = ({
  id,
  title,
  items,
  placeholder,
  onAdd,
  onChange,
  onRemove,
  isOpen,
  onToggle
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
            {items.map((item, index) => (
              <div
                key={`${id}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Item {index + 1}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${title} item ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>

                <input
                  type="text"
                  value={item}
                  onChange={(e) => onChange(index, normalizeValue(e.target.value))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No items added yet.
          </div>
        )}

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Add item
        </button>
      </div>
    </AccordionSection>
  );
};