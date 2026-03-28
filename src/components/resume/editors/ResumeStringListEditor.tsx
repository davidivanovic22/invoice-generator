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
  return (
    <AccordionSection
      id={id}
      title={title}
      isOpen={isOpen}
      onToggle={onToggle}
      badge={
        items.length ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {items.length}
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add item
        </button>
      </div>
    </AccordionSection>
  );
};